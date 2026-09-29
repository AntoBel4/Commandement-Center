import {TelegramReminders} from '../src/services/telegram-reminders.js';
import {family,alice,bob} from './fixtures.js';
export function fixture(store) {
  let now=Date.parse('2026-09-20T05:00:00Z');const calls=[],messages=[];
  store??={state:{links:{},pairs:{},deliveries:{},offset:0},async transaction(f,run){const draft=structuredClone(this.state),r=await run(draft,[alice,bob]);this.state=draft;return structuredClone(r);},async exclusive(f,run){return run();}};
  const client={async call(method){calls.push(method);return[];},async send(chat,text){messages.push({chat,text});return messages.length;}};
  const calendar={async list(){return {events:[]};}};
  const service=new TelegramReminders({store,familyId:family,botUsername:'test_maison_bot',client,calendar,portal:'https://example.test/',now:()=>now});
  return {service,store,client,calendar,messages,calls,setNow:v=>{now=Date.parse(v);}};
}
export async function link(service,user,chat,update=1){const p=await service.pair(user);const code=new URL(p.url).searchParams.get('start');await service.update({update_id:update,message:{chat:{id:chat,type:'private'},from:{id:chat,is_bot:false},text:'/start '+code}});}
