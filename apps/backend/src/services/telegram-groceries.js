// Telegram grocery flow (T05): capture, buttons, 17:20 recap with a 17:15 cut-off, urgent
// notifications and the 17:30 acceptance probe. All times are Europe/Paris.
import {parisInstant,followingDay} from './google-calendar.js';
export const RECAP_CUTOFF='17:15',RECAP_AT='17:20',PROBE_AT='17:30';
export const RECAP_WINDOW=10*60000,PROBE_WINDOW=15*60000,URGENT_WINDOW=30*60000;
const MAX_CAPTURE=10,MAX_BUTTON_ROWS=12,MAX_LINES=30;
const ACTIONS={b:'purchased',t:'tomorrow',u:'urgent',c:'cancelled'};
const clean=s=>String(s??'').replace(/[\r\n\t]+/g,' ').trim();
const short=(s,n)=>{const a=Array.from(clean(s));return a.length>n?a.slice(0,n-1).join('')+'…':a.join('');};
const amount=i=>[i.quantity??'',i.unit??''].join(' ').trim();
export const itemLine=i=>`${i.urgent?'❗ ':'• '}${short(i.name,60)}${amount(i)?' — '+short(amount(i),30):''}`;
export const LEGEND='Boutons : ✅ acheté · 📅 demain · ❗ urgent · ✖ annuler.';

// One row of four buttons per item. callback_data stays well under Telegram's 64-byte limit.
export function itemButtons(items) {
  const rows=items.slice(0,MAX_BUTTON_ROWS).map(i=>[
    {text:'✅ '+short(i.name,18),callback_data:`g:b:${i.id}`},
    {text:'📅 Demain',callback_data:`g:t:${i.id}`},
    {text:'❗ Urgent',callback_data:`g:u:${i.id}`},
    {text:'✖',callback_data:`g:c:${i.id}`}]);
  return rows.length?{inline_keyboard:rows}:undefined;
}
export function parseCallback(data) {
  const m=/^g:([btuc]):([0-9a-f-]{36})$/.exec(String(data??''));
  return m?{action:ACTIONS[m[1]],id:m[2]}:null;
}
// One line = one request. Commands (leading slash) are never captured.
export function parseCapture(text) {
  if(typeof text!=='string'||text.startsWith('/'))return null;
  const names=text.split('\n').map(clean).filter(Boolean);
  if(!names.length)return null;
  if(names.length>MAX_CAPTURE)return {error:`Maximum ${MAX_CAPTURE} articles par message. Rien n’a été ajouté.`};
  if(names.some(n=>Array.from(n).length>255))return {error:'Un article dépasse 255 caractères. Rien n’a été ajouté.'};
  return {names};
}
export const recapTimes=day=>({cutoff:Date.parse(parisInstant(day,RECAP_CUTOFF)),at:Date.parse(parisInstant(day,RECAP_AT)),probe:Date.parse(parisInstant(day,PROBE_AT))});
// Open requests available today or earlier and received at the latest at 17:15. Postponed and
// older open requests are included; later additions wait for the next recap. Urgency never
// changes eligibility.
export function recapItems(items,day) {
  const {cutoff}=recapTimes(day);
  return items.filter(i=>i.status==='open'&&i.available_on<=day&&Date.parse(i.created_at)<=cutoff)
    .sort((a,b)=>Number(b.urgent)-Number(a.urgent)||Date.parse(a.created_at)-Date.parse(b.created_at));
}
export function recapMessage(items,day,portal) {
  const eligible=recapItems(items,day);
  if(!eligible.length)return {text:`Maison · Courses du jour\nRien à acheter aujourd’hui.\n${portal}`};
  const lines=eligible.slice(0,MAX_LINES).map(itemLine);
  const more=eligible.length>MAX_LINES||eligible.length>MAX_BUTTON_ROWS;
  return {text:`Maison · Courses du jour (demandes reçues jusqu’à 17 h 15)\n${lines.join('\n')}${more?'\nSuite et autres boutons dans Maison.':''}\n${LEGEND}\n${portal}`,markup:itemButtons(eligible)};
}
export const captureMessage=items=>({text:`Maison · ${items.length>1?items.length+' courses ajoutées':'Course ajoutée'}\n${items.map(itemLine).join('\n')}\n${LEGEND}`,markup:itemButtons(items)});
export const urgentMessage=(item,portal)=>({text:`Maison · Course urgente\n${itemLine({...item,urgent:true})}\n${portal}`,markup:itemButtons([item])});
export const probeAlert=(day,missing,expected)=>`Maison · Alerte exploitation\nLe récapitulatif courses de 17 h 20 (${day}) n’a pas été accepté par Telegram pour ${missing} membre(s) sur ${expected}. Vérifiez le service Telegram et l’état des envois dans Maison.`;
export function changeFor(action,item,today) {
  if(action==='purchased')return {status:'purchased'};
  if(action==='cancelled')return {status:'cancelled'};
  if(action==='urgent')return {urgent:true};
  // "Demain" postpones to the day after today; a later planned date is left unchanged.
  const tomorrow=followingDay(today);
  return item.available_on<tomorrow?{availableOn:tomorrow}:null;
}
export const actionToast={purchased:'Acheté',cancelled:'Retiré de la liste',urgent:'Marqué urgent',tomorrow:'Reporté à demain'};
