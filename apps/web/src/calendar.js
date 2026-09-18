import { civilDate } from './client.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function addDays(day, n) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export function eventWhen(event) {
  const label = day => new Date(day+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'});
  if (event.allDay) {
    const last = addDays(event.end.date,-1);
    return label(event.start.date) + (last !== event.start.date ? ' au '+label(last) : '') + ' · Toute la journée';
  }
  const fmt = value => new Date(value).toLocaleString('fr-FR',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});
  return fmt(event.start.dateTime) + ' → ' + fmt(event.end.dateTime);
}
export class PendingEvent {
  constructor(storage, scope) { this.storage=storage; this.key='maison:calendar-pending:'+scope; }
  read() { const raw=this.storage.getItem(this.key); if (!raw) return null; const v=JSON.parse(raw); if (!v.key || !v.body?.title) throw Error('Envoi agenda sauvegardé illisible.'); return v; }
  prepare(body) { if (this.read()) throw Error('Vérifiez d’abord le rendez-vous en attente.'); const v={key:crypto.randomUUID(),body}; this.storage.setItem(this.key,JSON.stringify(v)); return v; }
  clear() { this.storage.removeItem(this.key); }
  async send(request) { const v=this.read(); if (!v) throw Error('Aucun rendez-vous en attente.'); const r=await request('/calendar/events',{method:'POST',body:v.body,key:v.key}); this.clear(); return r; }
}
export class CalendarView {
  constructor({ request, storage, scope, render, openModal, toast, unauthorized }) {
    Object.assign(this,{request,render,openModal,toast,unauthorized});
    this.pending=new PendingEvent(storage,scope); this.from=civilDate(); this.to=addDays(this.from,30);
    this.events=[]; this.error=''; this.updated=null; this.busy=false; this.epoch=0; this.active=true;
    this.click=e=>this.onClick(e); this.submit=e=>this.onSubmit(e);
    document.addEventListener('click',this.click); document.addEventListener('submit',this.submit);
    document.addEventListener('change',e=> { if (this.active && e.target.name==='allDay' && e.target.closest('#calendar-form')) this.toggleTimes(e.target.checked); });
  }
  destroy() { this.active=false; this.epoch++; this.events=[]; document.removeEventListener('click',this.click); document.removeEventListener('submit',this.submit); }
  saved() { try { return this.pending.read(); } catch { this.storageError=true; return null; } }
  async load() {
    if (!this.active || this.loading) return;
    const epoch=this.epoch; this.loading=true;
    try { const result=await this.request(`/calendar/events?from=${this.from}&to=${this.to}`);
      if (!this.active || epoch!==this.epoch) return;
      this.events=result.events; this.updated=result.fetchedAt; this.error='';
    } catch(e) { if (!this.active || epoch!==this.epoch) return; this.error=e.message; if ([401,403].includes(e.status)) this.unauthorized(e); }
    finally { this.loading=false; if (this.active && epoch===this.epoch) this.render(); }
  }
  card(compact=false) {
    const pending=this.saved();
    const events=compact ? this.events.filter(e=>e.allDay ? e.end.date>civilDate() : Date.parse(e.end.dateTime)>Date.now()).slice(0,3) : this.events;
    return `<section class="card card-pad calendar-card"><div class="row between wrap"><div><div class="eyebrow">Maison · Famille</div><h2>${compact?'Nos prochains rendez-vous.':'Notre agenda partagé.'}</h2></div><button class="btn primary" data-calendar="add" ${this.busy||pending||this.storageError?'disabled':''}>Ajouter un rendez-vous</button></div>
      <p class="form-note">Heure de Paris · Les changements faits dans Google apparaissent à l’actualisation.</p>
      ${!compact?`<form id="calendar-range" class="calendar-range"><label>Du<input aria-label="Début de la période" name="from" type="date" required value="${this.from}" min="2000-01-01" max="2099-12-31"></label><label>Au<input aria-label="Fin de la période" name="to" type="date" required value="${this.to}" min="2000-01-01" max="2099-12-31"></label><button class="btn" ${this.loading||this.busy?'disabled':''}>Afficher</button></form>`:''}
      ${this.error?`<div class="banner notice-error" role="alert">${esc(this.error)} Les informations affichées peuvent être anciennes.</div>`:''}
      ${this.storageError?'<div class="banner notice-error">Le stockage de cet onglet est indisponible. Ajouts suspendus pour éviter les doublons.</div>':''}
      ${pending?`<div class="calendar-pending"><h3>Un rendez-vous reste à vérifier</h3><p>${esc(pending.body.title)}</p><p>Reprenez le même envoi pour vérifier son résultat sans doublon.</p><div class="row wrap"><button class="btn" data-calendar="retry" ${this.busy?'disabled':''}>Reprendre l’envoi</button><button class="btn text" data-calendar="discard" ${this.busy?'disabled':''}>Oublier cet envoi</button></div></div>`:''}
      ${!this.updated?'<p class="empty">'+(this.error?'Agenda indisponible.':'Chargement de l’agenda…')+'</p>':events.length?events.map(e=>`<div class="agenda-item"><div class="event-line"></div><div class="event-content"><button class="event-open" data-calendar="detail" data-id="${esc(e.id)}"><h3>${esc(e.title)}</h3><small>${esc(eventWhen(e))}</small>${e.location?`<small>${esc(e.location)}</small>`:''}${e.recurring?'<small>Rendez-vous récurrent</small>':''}${e.private?'<small>Détails privés masqués</small>':''}</button></div></div>`).join(''):'<div class="empty">Aucun rendez-vous sur cette période.</div>'}
      <div class="row between wrap calendar-footer"><small>${this.updated?'Agenda lu à '+new Date(this.updated).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):''}</small><button class="btn text" data-calendar="refresh" ${this.loading||this.busy?'disabled':''}>Actualiser l’agenda</button></div>${compact?'<button class="btn" data-view="agenda">Ouvrir l’agenda</button>':'<a class="btn" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noopener noreferrer">Modifier ou gérer les répétitions dans Google Agenda</a>'}</section>`;
  }
  toggleTimes(allDay) { for (const input of document.querySelectorAll('#calendar-form input[type=time]')) { input.disabled=allDay; input.required=!allDay; } }
  add() {
    if (this.saved()||this.storageError) return;
    const date=civilDate();
    this.openModal('Un moment à partager.',`<form id="calendar-form"><div class="field"><label for="calendar-title">Rendez-vous</label><input id="calendar-title" name="title" required maxlength="255" autocomplete="off"></div><label class="checkbox"><input type="checkbox" name="allDay">Toute la journée</label><div class="two"><div class="field"><label for="calendar-date">Début</label><input id="calendar-date" name="date" type="date" value="${date}" min="2000-01-01" max="2099-12-31" required><input aria-label="Heure de début" name="time" type="time" value="10:00" required></div><div class="field"><label for="calendar-end-date">Fin</label><input id="calendar-end-date" name="endDate" type="date" value="${date}" min="2000-01-01" max="2099-12-31" required><input aria-label="Heure de fin" name="endTime" type="time" value="11:00" required></div></div><div class="field"><label for="calendar-location">Lieu <small>(facultatif)</small></label><input id="calendar-location" name="location" maxlength="255"></div><div class="field"><label for="calendar-description">Précisions <small>(facultatif)</small></label><textarea id="calendar-description" name="description" maxlength="5000" rows="3"></textarea></div><p class="form-note">Heure de Paris. Ce rendez-vous sera enregistré directement dans l’agenda partagé et visible par le foyer.</p><p id="calendar-error" class="field-error" role="alert"></p><div class="form-footer"><button class="btn" type="button" data-action="close">Fermer</button><button class="btn primary" type="submit">Enregistrer dans l’agenda</button></div></form>`);
  }
  async send() {
    if (this.busy) return; this.busy=true; const epoch=this.epoch;
    document.querySelector('#modal').close(); this.render();
    try { const pending=this.saved(); const result=await this.pending.send(this.request);
      if (!this.active||epoch!==this.epoch) return;
      this.from=pending.body.date; this.to=addDays(this.from,30); this.events=[]; this.updated=null;
      await this.load(); this.toast(result.replayed?'Rendez-vous déjà enregistré dans Google Agenda.':'Rendez-vous enregistré dans Google Agenda.');
    } catch(e) {
      if (!this.active||epoch!==this.epoch) return;
      if(e.status===400) this.pending.clear();
      this.error=e.message; if ([401,403].includes(e.status)) this.unauthorized(e);
    } finally { this.busy=false; if(this.active&&epoch===this.epoch) this.render(); }
  }
  async onClick(event) {
    const button=event.target.closest('[data-calendar]'); if (!button||button.disabled||!this.active||this.busy) return;
    const action=button.dataset.calendar;
    if(action==='refresh') return this.load();
    if(action==='add') return this.add();
    if(action==='retry') return this.send();
    if(action==='discard') return this.openModal('Oublier cet envoi ?',`<p>Le rendez-vous peut déjà exister dans Google. Vérifiez l’agenda avant de l’ajouter à nouveau.</p><div class="form-footer"><button class="btn" data-action="close">Garder l’envoi</button><button class="btn" data-calendar="confirm-discard">Oublier cet envoi</button></div>`);
    if(action==='confirm-discard') { this.pending.clear(); document.querySelector('#modal').close(); this.render(); return; }
    if(action==='detail') { const e=this.events.find(e=>e.id===button.dataset.id); if(e) this.openModal(e.title,`<p>${esc(eventWhen(e))}</p>${e.location?`<p>${esc(e.location)}</p>`:''}<p class="calendar-description">${esc(e.description)}</p><p class="form-note">${e.private?'Les détails de ce rendez-vous sont privés.':'Les modifications et annulations faites dans Google seront visibles après actualisation.'}</p><a class="btn" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noopener noreferrer">Ouvrir Google Agenda</a>`); }
  }
  async onSubmit(event) {
    const form=event.target; if(!this.active||!['calendar-form','calendar-range'].includes(form.id)) return;
    event.preventDefault(); if(this.busy||this.loading) return;
    const v=Object.fromEntries(new FormData(form));
    if(form.id==='calendar-range') {
      if(v.to<v.from||Date.parse(v.to)-Date.parse(v.from)>92*86400000) { this.error='Choisissez une période de 93 jours maximum.'; this.render(); return; }
      this.from=v.from; this.to=v.to; this.updated=null; this.events=[]; return this.load();
    }
    const allDay=v.allDay==='on';
    if(v.endDate<v.date||(!allDay&&v.endDate===v.date&&v.endTime<=v.time)) { document.querySelector('#calendar-error').textContent='La fin doit être après le début.'; return; }
    try { this.pending.prepare({title:v.title.trim(),date:v.date,endDate:v.endDate,allDay,...(!allDay?{time:v.time,endTime:v.endTime}:{}),location:v.location.trim(),description:v.description.trim()}); await this.send(); }
    catch(e) { document.querySelector('#calendar-error').textContent=e.message; }
  }
}
