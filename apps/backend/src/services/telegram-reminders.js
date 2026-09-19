import {createHash,randomBytes} from 'node:crypto';
import {parisInstant,followingDay} from './google-calendar.js';
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
  constructor({store,familyId,botUsername,calendar,client,portal,now=Date.now}) {Object.assign(this,{store,familyId,botUsername,calendar,client,portal,now});}
  async status(user) {
    return this.store.transaction(this.familyId,(s,members)=>{
      if(!members.includes(user))throw Error('TELEGRAM_MEMBER');
      const link=s.links[user];
      const receipts=Object.values(s.deliveries).filter(r=>r.user===user).sort((a,b)=>b.at-a.at);
      return {available:true,linked:!!link,enabled:!!link?.enabled,quietUntil:link?.quietUntil??null,
        workerHealthy:!!s.heartbeat&&this.now()-s.heartbeat<180000,calendarHealthy:s.calendarHealthy??false,
        lastDelivery:receipts[0]?{status:receipts[0].status,at:receipts[0].at}:null};
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
  async update(update) {
    return this.store.transaction(this.familyId,(s,members)=>{
      if(!Number.isSafeInteger(update.update_id)||update.update_id<s.offset)return;
      s.offset=update.update_id+1;
      const m=update.message;
      if(!m||m.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0||m.from?.id!==m.chat.id||m.from.is_bot)return;
      const text=m.text??'', chat=String(m.chat.id);
      if(text==='/stop') {
        for(const user of Object.keys(s.links))if(s.links[user].chat===chat)delete s.links[user];
        return;
      }
      const code=text.match(/^\/start ([A-Za-z0-9_-]{32})$/)?.[1];if(!code)return;
      for(const [user,pair] of Object.entries(s.pairs)) {
        if(pair.expires>this.now()&&pair.hash===hash(code)&&members.includes(user)&&!s.links[user]&&!Object.values(s.links).some(l=>l.chat===chat)) {
          s.links[user]={chat,enabled:true,quietUntil:null};delete s.pairs[user];return;
        }
      }
    });
  }
  async deliver(user,key,text) {
    const id=hash(user+':'+key), now=this.now();
    const chat=await this.store.transaction(this.familyId,(s,members)=>{
      const link=s.links[user],prior=s.deliveries[id];
      if(!members.includes(user)||!link?.enabled||link.quietUntil>now)return null;
      if(prior && !(prior.status==='retry'&&prior.next<=now&&prior.attempts<3))return null;
      // Commit before sending. Unknown outcomes are never replayed automatically.
      s.deliveries[id]={user,status:'unknown',at:now,attempts:(prior?.attempts??0)+1};return link.chat;
    });
    if(!chat)return;
    let status='accepted',messageId,next;
    try {messageId=await this.client.send(chat,text);}
    catch(e) {status=e.code==='TELEGRAM_RETRY'?'retry':e.code==='TELEGRAM_REJECTED'?'rejected':'unknown';next=this.now()+(e.retryAfter??60)*1000;}
    await this.store.transaction(this.familyId,s=>{Object.assign(s.deliveries[id],{status,messageId,next});});
  }
  async tick() {
    return this.store.exclusive(this.familyId,async()=>{
      const offset=await this.store.transaction(this.familyId,s=>s.offset);
      const updates=await this.client.call('getUpdates',{offset,timeout:20,allowed_updates:['message']});
      for(const update of updates)await this.update(update);
      const users=await this.store.transaction(this.familyId,(s,members)=>{
        s.heartbeat=this.now();
        for(const [id,r] of Object.entries(s.deliveries))if(r.at<this.now()-90*86400000)delete s.deliveries[id];
        return members.filter(u=>s.links[u]?.enabled);
      });
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
