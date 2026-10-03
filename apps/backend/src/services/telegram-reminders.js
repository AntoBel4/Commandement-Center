import {createHash,randomBytes} from 'node:crypto';
import {parisInstant,followingDay} from './google-calendar.js';
import {GroceryError} from './grocery-model.js';
import * as G from './telegram-groceries.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
export const parisDate=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const clock=ms=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
const clean=s=>String(s??'').replace(/[\r\n\t]+/g,' ').slice(0,180);
const label=e=>`${e.allDay?'Journée entière':clock(Date.parse(e.start.dateTime))} · ${clean(e.private?'Occupé':e.title)}${!e.private&&e.location?' — '+clean(e.location):''}`;
const due=(now,at,window)=>now>=at&&now<at+window;
export function scheduledMessages(events,now,portal) {
  const day=parisDate(now), result=[];
  const start=Date.parse(parisInstant(day)),end=Date.parse(parisInstant(followingDay(day)));
  const today=events.filter(e=>e.allDay?e.start.date<=day&&e.end.date>day:Date.parse(e.start.dateTime)<end&&Date.parse(e.end.dateTime)>start);
  if(due(now,Date.parse(parisInstant(day,'07:00')),15*60000)) {
    const lines=today.slice(0,15).map(label);
    result.push({key:'morning:'+day,text:`Maison · Votre agenda du jour\n${lines.length?lines.join('\n'):'Aucun rendez-vous prévu aujourd’hui.'}${today.length>15?'\nSuite dans Maison.':''}\n${portal}`});
  }
  if(due(now,Date.parse(parisInstant(day,'09:00')),15*60000)) {
    const allDay=today.filter(e=>e.allDay);
    if(allDay.length)result.push({key:'all-day:'+day,text:`Maison · Rendez-vous sans heure aujourd’hui\n${allDay.slice(0,15).map(label).join('\n')}${allDay.length>15?'\nSuite dans Maison.':''}\n${portal}`});
  }
  for(const e of events.filter(e=>!e.allDay)) {
    const at=Date.parse(e.start.dateTime)-3600000;
    if(due(now,at,5*60000))result.push({key:'event:'+hash(e.id+':'+e.start.dateTime),text:`Maison · Rendez-vous dans une heure\n${label(e)}\n${portal}`});
  }
  return result.map(message=>({...message,text:Array.from(message.text).length>3900?Array.from(message.text).slice(0,3600).join('')+'\nSuite dans Maison.\n'+portal:message.text}));
}
export class TelegramReminders {
  constructor({store,familyId,botUsername,calendar,client,portal,groceries=null,alertUser=null,now=Date.now}) {Object.assign(this,{store,familyId,botUsername,calendar,client,portal,groceries,alertUser,now});}
  async status(user) {
    return this.store.transaction(this.familyId,(s,members)=>{
      if(!members.includes(user))throw Error('TELEGRAM_MEMBER');
      const link=s.links[user];
      const receipts=Object.values(s.deliveries).filter(r=>r.user===user).sort((a,b)=>b.at-a.at);
      const recap=receipts.find(r=>r.kind==='recap'),probeDay=Object.keys(s.probes??{}).sort().at(-1);
      return {available:true,linked:!!link,enabled:!!link?.enabled,quietUntil:link?.quietUntil??null,
        workerHealthy:!!s.heartbeat&&this.now()-s.heartbeat<180000,calendarHealthy:s.calendarHealthy??false,
        lastDelivery:receipts[0]?{status:receipts[0].status,at:receipts[0].at,kind:receipts[0].kind??null}:null,
        groceries:s.groceriesHealthy===undefined?null:{healthy:s.groceriesHealthy,lastRecap:recap?{status:recap.status,at:recap.at}:null,
          probe:probeDay?{day:probeDay,expected:s.probes[probeDay].expected,accepted:s.probes[probeDay].accepted}:null}};
    });
  }
  async pair(user) {
    const code=randomBytes(24).toString('base64url');
    await this.store.transaction(this.familyId,(s,members)=>{
      if(!members.includes(user))throw Error('TELEGRAM_MEMBER');
      if(s.links[user])throw Error('TELEGRAM_ALREADY_LINKED');
      s.pairs[user]={hash:hash(code),expires:this.now()+10*60000};
    });
    return {url:`https://t.me/${this.botUsername}?start=${code}`,expiresIn:600};
  }
  async settings(user,action) {
    await this.store.transaction(this.familyId,(s,members)=>{
      if(!members.includes(user))throw Error('TELEGRAM_MEMBER');
      if(action==='unlink'){delete s.links[user];delete s.pairs[user];return;}
      const link=s.links[user];if(!link)throw Error('TELEGRAM_NOT_LINKED');
      if(action==='enable')link.enabled=true;
      if(action==='disable')link.enabled=false;
      if(action==='quiet')link.quietUntil=Date.parse(parisInstant(followingDay(parisDate(this.now())),'07:00'));
      if(action==='resume')link.quietUntil=null;
    });return this.status(user);
  }
  async requestTest(user,key) {
    await this.store.transaction(this.familyId,(s,members)=>{
      if(!members.includes(user)||!s.links[user]?.enabled)throw Error('TELEGRAM_NOT_LINKED');
      s.tests??={};const old=s.tests[user];
      if(old?.key===key)return;
      if(old&&this.now()-old.at<60000)throw Error('TELEGRAM_TEST_LIMIT');
      s.tests[user]={key,at:this.now()};
    });return {queued:true};
  }
  // Pairing, /stop and ignored updates advance the offset in one transaction. A grocery action
  // keeps the offset until its durable write is done, so a crash replays it with the same
  // idempotency key instead of losing it; the confirmation is queued only after that write.
  async update(update) {
    if(!Number.isSafeInteger(update?.update_id))return;
    const intent=await this.store.transaction(this.familyId,(s,members)=>{
      if(update.update_id<s.offset)return null;
      const intent=this.classify(update,s,members);
      if(!intent)s.offset=update.update_id+1;
      return intent;
    });
    if(!intent)return;
    const result=await this.applyGrocery(intent,update.update_id);
    await this.store.transaction(this.familyId,s=>{
      if(update.update_id<s.offset)return;
      s.offset=update.update_id+1;s.outbox??=[];
      for(const m of result.messages)s.outbox.push({...m,user:intent.user,until:this.now()+5*60000});
    });
    if(intent.callback)await this.client.call('answerCallbackQuery',{callback_query_id:intent.callback,text:result.toast}).catch(()=>{});
  }
  classify(update,s,members) {
    const m=update.message,q=update.callback_query;
    if(m) {
      if(m.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0||m.from?.id!==m.chat.id||m.from.is_bot)return null;
      const text=m.text??'', chat=String(m.chat.id);
      if(text==='/stop') {
        for(const user of Object.keys(s.links))if(s.links[user].chat===chat)delete s.links[user];
        return null;
      }
      const code=text.match(/^\/start ([A-Za-z0-9_-]{32})$/)?.[1];
      if(code) {
        for(const [user,pair] of Object.entries(s.pairs)) {
          if(pair.expires>this.now()&&pair.hash===hash(code)&&members.includes(user)&&!s.links[user]&&!Object.values(s.links).some(l=>l.chat===chat)) {
            s.links[user]={chat,enabled:true,quietUntil:null};delete s.pairs[user];return null;
          }
        }
        return null;
      }
      const user=members.find(u=>s.links[u]?.chat===chat),capture=this.groceries&&user&&G.parseCapture(text);
      return capture?{kind:'capture',user,...capture}:null;
    }
    if(q&&this.groceries&&typeof q.id==='string') {
      const chat=q.message?.chat;
      const ok=chat?.type==='private'&&Number.isSafeInteger(chat.id)&&q.from?.id===chat.id&&!q.from.is_bot;
      const user=ok?members.find(u=>s.links[u]?.chat===String(chat.id)):undefined;
      return {kind:'callback',callback:q.id,user,...(G.parseCallback(q.data)??{})};
    }
    return null;
  }
  async applyGrocery(intent,updateId) {
    const key='capture:'+updateId,none=toast=>({messages:[],toast});
    if(intent.kind==='capture') {
      if(intent.error)return {messages:[{key,text:'Maison · '+intent.error}]};
      try {
        const items=await this.groceries.addGroceryBatch(intent.names.map(name=>({name,source:'telegram'})),this.familyId,{actorId:intent.user,requestKey:'telegram:'+updateId});
        return {messages:[{key,...G.captureMessage(items)}]};
      } catch(e) {
        if(!(e instanceof GroceryError))throw e;
        return {messages:[{key,text:'Maison · Ajout impossible. Rien n’a été enregistré ; réessayez depuis Maison.'}]};
      }
    }
    if(!intent.user||!intent.action)return none('Action non disponible.');
    for(let attempt=0;;attempt++) {
      const item=await this.groceries.getGrocery(intent.id,this.familyId);
      if(!item)return none('Course introuvable.');
      if(item.status!=='open')return none(item.status==='purchased'?'Déjà achetée.':'Déjà retirée de la liste.');
      const change=G.changeFor(intent.action,item,parisDate(this.now()));
      if(!change)return none('Déjà prévue plus tard.');
      try {
        const saved=await this.groceries.updateGrocery(item.id,{...change,version:item.version},this.familyId,intent.user);
        return saved?none(`${G.actionToast[intent.action]} : ${saved.name}`.slice(0,190)):none('Course introuvable.');
      } catch(e) {
        if(!(e instanceof GroceryError))throw e;
        if(e.code!=='VERSION_CONFLICT'||attempt)return none('Action impossible. Ouvrez Maison.');
      }
    }
  }
  // reply: direct answer to the member's own action; ignoreQuiet: urgent (D5) and operator alert.
  async deliver(user,key,text,{markup,reply=false,ignoreQuiet=false}={}) {
    const id=hash(user+':'+key), now=this.now();
    const chat=await this.store.transaction(this.familyId,(s,members)=>{
      const link=s.links[user],prior=s.deliveries[id];
      if(!members.includes(user)||!link)return null;
      if(!reply&&(!link.enabled||(!ignoreQuiet&&link.quietUntil>now)))return null;
      if(prior && !(prior.status==='retry'&&prior.next<=now&&prior.attempts<3))return null;
      // Commit before sending. Unknown outcomes are never replayed automatically.
      s.deliveries[id]={user,kind:key.split(':')[0],status:'unknown',at:now,attempts:(prior?.attempts??0)+1};return link.chat;
    });
    if(!chat)return;
    let status='accepted',messageId,next;
    try {messageId=await this.client.send(chat,text,markup);}
    catch(e) {status=e.code==='TELEGRAM_RETRY'?'retry':e.code==='TELEGRAM_REJECTED'?'rejected':'unknown';next=this.now()+(e.retryAfter??60)*1000;}
    await this.store.transaction(this.familyId,s=>{Object.assign(s.deliveries[id],{status,messageId,next});});
  }
  async flushOutbox() {
    const outbox=await this.store.transaction(this.familyId,s=>s.outbox??[]);
    if(!outbox.length)return;
    for(const m of outbox)await this.deliver(m.user,m.key,m.text,{markup:m.markup,reply:true});
    await this.store.transaction(this.familyId,s=>{
      s.outbox=(s.outbox??[]).filter(m=>s.deliveries[hash(m.user+':'+m.key)]?.status==='retry'&&m.until>this.now());
    });
  }
  async urgentActor(item) {
    const history=await this.groceries.listGroceryHistory(item.id,this.familyId);
    return [...history].reverse().find(h=>h.after_data?.urgent&&!h.before_data?.urgent)?.actor_id??null;
  }
  async groceryCycle() {
    const now=this.now(),day=parisDate(now),t=G.recapTimes(day);
    const open=await this.groceries.listGroceries({familyId:this.familyId,status:'open'});
    // Urgent requests (Telegram, portal or Alexa) notify immediately, once per marking. Requests
    // already urgent when this feature first runs are recorded without notification.
    const {fresh,linked}=await this.store.transaction(this.familyId,(s,members)=>{
      const seed=!s.urgent,next={};
      for(const i of open.filter(i=>i.urgent))next[i.id]=s.urgent?.[i.id]??(seed?0:now);
      s.urgent=next;
      return {fresh:open.filter(i=>next[i.id]&&now-next[i.id]<G.URGENT_WINDOW).map(item=>({item,since:next[item.id]})),linked:members.filter(u=>s.links[u])};
    });
    for(const {item,since} of fresh) {
      const actor=await this.urgentActor(item);
      const message=G.urgentMessage(item,this.portal);
      for(const user of linked)if(user!==actor)await this.deliver(user,`urgent:${item.id}:${since}`,message.text,{markup:message.markup,ignoreQuiet:true});
    }
    if(now>=t.at&&now<t.at+G.RECAP_WINDOW) {
      const message=G.recapMessage(open,day,this.portal);
      for(const user of linked)await this.deliver(user,'recap:'+day,message.text,{markup:message.markup});
    }
    if(now>=t.probe&&now<t.probe+G.PROBE_WINDOW)await this.probe(day,t);
  }
  // Checks that Telegram accepted each expected recap. Acceptance is not proof of reading.
  async probe(day,t) {
    const result=await this.store.transaction(this.familyId,(s,members)=>{
      s.probes??={};if(s.probes[day])return null;
      const expected=members.filter(u=>s.links[u]?.enabled&&!(s.links[u].quietUntil>t.at));
      const accepted=expected.filter(u=>s.deliveries[hash(u+':recap:'+day)]?.status==='accepted');
      s.probes[day]={expected:expected.length,accepted:accepted.length,at:this.now()};
      for(const old of Object.keys(s.probes).sort().slice(0,-30))delete s.probes[old];
      return s.probes[day];
    });
    if(!result||result.accepted===result.expected)return;
    console.error('grocery_recap_unconfirmed');
    if(this.alertUser)await this.deliver(this.alertUser,'probe:'+day,G.probeAlert(day,result.expected-result.accepted,result.expected),{ignoreQuiet:true});
  }
  async tick() {
    return this.store.exclusive(this.familyId,async()=>{
      const offset=await this.store.transaction(this.familyId,s=>s.offset);
      const updates=await this.client.call('getUpdates',{offset,timeout:20,allowed_updates:['message','callback_query']});
      for(const update of updates)await this.update(update);
      const users=await this.store.transaction(this.familyId,(s,members)=>{
        s.heartbeat=this.now();
        for(const [id,r] of Object.entries(s.deliveries))if(r.at<this.now()-90*86400000)delete s.deliveries[id];
        return members.filter(u=>s.links[u]?.enabled);
      });
      await this.flushOutbox();
      if(this.groceries) {
        let healthy=true;
        try {await this.groceryCycle();} catch {healthy=false;console.error('grocery_cycle_unavailable');}
        await this.store.transaction(this.familyId,s=>{s.groceriesHealthy=healthy;});
      }
      if(!users.length)return;
      const tests=await this.store.transaction(this.familyId,s=>s.tests??{});
      for(const user of users)if(tests[user]&&this.now()-tests[user].at<5*60000)await this.deliver(user,'test:'+tests[user].key,'Maison · Votre Telegram est bien relié. Les rappels arriveront ici.');
      let events;
      try {events=(await this.calendar.list({from:parisDate(this.now()),to:parisDate(this.now()+86400000)})).events;}
      catch {await this.store.transaction(this.familyId,s=>{s.calendarHealthy=false;});return;}
      await this.store.transaction(this.familyId,s=>{s.calendarHealthy=true;});
      for(const message of scheduledMessages(events,this.now(),this.portal))for(const user of users)await this.deliver(user,message.key,message.text);
    });
  }
}
