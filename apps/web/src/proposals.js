import { civilDate } from './client.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function slotLabel(slot) {
  const date = value => new Date(value+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'});
  return `${date(slot.date)} à ${slot.time} → ${slot.endDate===slot.date?'':date(slot.endDate)+' à '}${slot.endTime}`;
}
function agreementStatus(proposal,userId) {
  const votes=proposal.members.map(member=>proposal.votes[member]);
  const count=votes.filter(vote=>Number.isInteger(vote)).length;
  if(proposal.status==='publishing') return '<div class="proposal-state"><strong>Accord trouvé</strong><p>Vous avez validé le même créneau. La création dans Google reste à confirmer.</p></div>';
  if(count===2 && votes[0]!==votes[1]) return '<div class="proposal-state disagreement" role="status"><strong>Sans accord commun</strong><p>Vous avez choisi des créneaux différents. Aucun rendez-vous n’est créé. Pour avancer, l’un de vous peut valider le créneau choisi par l’autre.</p></div>';
  if(count===0) return '<div class="proposal-state"><strong>En attente des deux accords</strong><p>Aucun de vous n’a encore validé de créneau. La proposition seule ne crée pas de rendez-vous.</p></div>';
  const mine=Number.isInteger(proposal.votes[userId]);
  return `<div class="proposal-state"><strong>${mine?'En attente de l’accord de l’autre membre':'En attente de votre accord'}</strong><p>${mine?'Votre choix est enregistré. L’autre membre doit valider le même créneau.':'L’autre membre a fait son choix. Validez le même créneau pour créer le rendez-vous, ou choisissez-en un autre.'}</p></div>`;
}
export class PendingProposal {
  constructor(storage,scope) { this.storage=storage;this.key='maison:proposal-pending:'+scope; }
  read() { const raw=this.storage.getItem(this.key);if(!raw)return null;const v=JSON.parse(raw);if(!v.key||!v.body?.slots)throw Error('Proposition sauvegardée illisible.');return v; }
  prepare(body) { if(this.read())throw Error('Reprenez d’abord la proposition en attente.');const v={key:crypto.randomUUID(),body};this.storage.setItem(this.key,JSON.stringify(v));return v; }
  clear() { this.storage.removeItem(this.key); }
  async send(request) { const v=this.read();if(!v)throw Error('Aucune proposition en attente.');const r=await request('/calendar/proposals',{method:'POST',body:v.body,key:v.key});this.clear();return r; }
}
export class ProposalsView {
  constructor({request,storage,scope,userId,render,openModal,toast,unauthorized,refreshCalendar}) {
    Object.assign(this,{request,userId,render,openModal,toast,unauthorized,refreshCalendar});
    this.pending=new PendingProposal(storage,scope);this.proposals=[];this.error='';this.active=true;this.busy=false;this.loaded=false;
    this.click=e=>this.onClick(e);this.submit=e=>this.onSubmit(e);
    document.addEventListener('click',this.click);document.addEventListener('submit',this.submit);
  }
  destroy() { this.active=false;this.proposals=[];document.removeEventListener('click',this.click);document.removeEventListener('submit',this.submit); }
  saved() { try {return this.pending.read();}catch {this.storageError=true;return null;} }
  async load() {
    if(!this.active||this.loading)return;
    this.loading=true;
    try { const result=await this.request('/calendar/proposals');if(this.active){this.proposals=result.proposals;this.loaded=true;this.error='';} }
    catch(e) { if(this.active){this.error=e.message;if([401,403].includes(e.status))this.unauthorized(e);} }
    finally {this.loading=false;if(this.active)this.render();}
  }
  card(compact=false) {
    const saved=this.saved(), blocked=this.busy||this.loading;
    const list=this.proposals.filter(p=>p.status!=='cancelled'&&p.status!=='confirmed');
    const confirmed=this.proposals.filter(p=>p.status==='confirmed').slice(-3).reverse();
    return `<section class="card card-pad proposals-card"><div class="row between wrap"><div><div class="eyebrow">À décider ensemble</div><h2>Un créneau qui nous convient.</h2></div><button class="btn primary" data-proposal="new" ${blocked||saved||this.storageError?'disabled':''}>Proposer des créneaux</button></div><p class="form-note">Chacun valide avec son compte. Le même créneau accepté par vous deux crée le rendez-vous dans Google. Les disponibilités ne sont pas vérifiées automatiquement.</p>
      ${this.error?`<div class="banner notice-error" role="alert">${esc(this.error)} Actualisez pour vérifier les choix enregistrés.</div>`:''}
      ${this.storageError?'<p role="alert">Stockage indisponible : les nouvelles propositions sont suspendues.</p>':''}
      ${saved?`<div class="calendar-pending"><p>Envoi à vérifier : ${esc(saved.body.title)}</p><button class="btn" data-proposal="resend" ${blocked?'disabled':''}>Reprendre la proposition</button></div>`:''}
      ${!this.loaded?'<p class="empty">'+(this.error?'Propositions indisponibles.':'Chargement des propositions…')+'</p>':!list.length?'<p class="empty">Aucune proposition en attente.</p>':''}
      ${list.map(p=>`<article class="proposal"><h3>${esc(p.body.title)}</h3>${p.body.location?`<p>${esc(p.body.location)}</p>`:''}${p.body.description?`<p class="calendar-description">${esc(p.body.description)}</p>`:''}
        ${agreementStatus(p,this.userId)}
        ${p.body.slots.map((slot,i)=>{const mine=p.votes[this.userId]===i,other=p.members.some(m=>m!==this.userId&&p.votes[m]===i);return `<div class="proposal-slot"><p>${esc(slotLabel(slot))}</p><p class="form-note">Vous : ${mine?'accord donné':'sans accord'} · Autre membre : ${other?'accord donné':'sans accord'}</p>${p.status==='pending'?`<button class="btn ${mine?'':'primary'}" data-proposal="${mine?'withdraw':'approve'}" data-id="${p.id}" data-slot="${i}" ${blocked||this.error?'disabled':''}>${mine?'Retirer mon accord':'Valider ce créneau'}</button>`:''}</div>`;}).join('')}
        ${p.status==='publishing'?`<div class="calendar-pending"><p>Deux accords reçus. La création dans Google reste à confirmer. Ce choix est figé pendant la vérification.</p><button class="btn primary" data-proposal="retry" data-id="${p.id}" ${blocked?'disabled':''}>Vérifier la création</button></div>`:`<button class="btn text" data-proposal="cancel" data-id="${p.id}" ${blocked||this.error?'disabled':''}>Annuler la proposition</button>`}</article>`).join('')}
      ${!compact&&confirmed.length?`<details><summary>Dernières créations confirmées</summary>${confirmed.map(p=>`<p>${esc(p.body.title)} · Création confirmée dans Google le ${esc(new Date(p.confirmedAt).toLocaleDateString('fr-FR'))}. L’agenda ci-dessus reflète les changements ultérieurs.</p>`).join('')}</details>`:''}
      <button class="btn text" data-proposal="refresh" ${blocked?'disabled':''}>Actualiser les propositions</button></section>`;
  }
  slotFields(index,date=civilDate()) {
    return `<fieldset class="proposal-fields"><legend>Créneau ${index+1}</legend><div class="two"><label>Début<input name="date${index}" type="date" value="${date}" min="2000-01-01" max="2099-12-31" required><input aria-label="Heure de début du créneau ${index+1}" name="time${index}" type="time" value="10:00" required></label><label>Fin<input name="endDate${index}" type="date" value="${date}" min="2000-01-01" max="2099-12-31" required><input aria-label="Heure de fin du créneau ${index+1}" name="endTime${index}" type="time" value="11:00" required></label></div></fieldset>`;
  }
  add() {
    if(this.saved()||this.storageError)return;
    this.openModal('Trouvons notre créneau.',`<form id="proposal-form"><div class="field"><label for="proposal-title">Rendez-vous</label><input id="proposal-title" name="title" required maxlength="255"></div><div class="field"><label for="proposal-location">Lieu (facultatif)</label><input id="proposal-location" name="location" maxlength="255"></div><div class="field"><label for="proposal-description">Précisions (facultatif)</label><textarea id="proposal-description" name="description" rows="2" maxlength="5000"></textarea></div><div id="proposal-slots">${this.slotFields(0)}</div><div class="row wrap"><button class="btn" type="button" data-proposal="more">Ajouter un créneau</button><button class="btn text" type="button" data-proposal="less" disabled>Retirer le dernier</button></div><p class="form-note">1 à 5 créneaux · Heure de Paris. Proposer ne vaut pas accord : chacun devra ensuite valider le même horaire. Pour changer une proposition publiée, annulez-la puis proposez à nouveau.</p><p id="proposal-error" class="field-error" role="alert"></p><div class="form-footer"><button class="btn" type="button" data-action="close">Fermer</button><button class="btn primary">Partager la proposition</button></div></form>`);
  }
  async operation(action) {
    if(this.busy||!this.active)return;this.busy=true;document.querySelector('#modal').close();this.render();
    let error='';
    try { const result=await action();if(!this.active)return;
      this.toast(result.proposal.status==='confirmed'?'Rendez-vous créé dans Google Agenda.':result.proposal.status==='cancelled'?'Proposition annulée.':'Votre choix est enregistré.');
      if(result.proposal.status==='confirmed')await this.refreshCalendar();
    } catch(e) {if(!this.active)return;error=e.message;if([401,403].includes(e.status))this.unauthorized(e);}
    finally {this.busy=false;if(this.active){await this.load();if(error)this.error=error;this.render();}}
  }
  send() {return this.operation(async()=>{try{return await this.pending.send(this.request);}catch(e){if(e.status===400)this.pending.clear();throw e;}});}
  async onSubmit(e) {
    if(!this.active||e.target.id!=='proposal-form')return;e.preventDefault();if(this.busy)return;
    const form=e.target,v=Object.fromEntries(new FormData(form));
    const slots=[...form.querySelectorAll('.proposal-fields')].map((_,i)=>({date:v['date'+i],time:v['time'+i],endDate:v['endDate'+i],endTime:v['endTime'+i]}));
    if(slots.some(s=>s.endDate<s.date||(s.endDate===s.date&&s.endTime<=s.time))) {document.querySelector('#proposal-error').textContent='La fin de chaque créneau doit être après le début.';return;}
    try {this.pending.prepare({title:v.title.trim(),location:v.location.trim(),description:v.description.trim(),slots});await this.send();}
    catch(error) {document.querySelector('#proposal-error').textContent=error.message;}
  }
  async onClick(e) {
    const b=e.target.closest('[data-proposal]');if(!this.active||!b||b.disabled||this.busy)return;
    const action=b.dataset.proposal;
    if(action==='new')return this.add();
    if(action==='refresh')return this.load();
    if(action==='resend')return this.send();
    if(action==='more'||action==='less') {
      const box=document.querySelector('#proposal-slots'),n=box.children.length;
      if(action==='more'&&n<5)box.insertAdjacentHTML('beforeend',this.slotFields(n));
      if(action==='less'&&n>1)box.lastElementChild.remove();
      document.querySelector('[data-proposal=more]').disabled=box.children.length>=5;
      document.querySelector('[data-proposal=less]').disabled=box.children.length<=1;return;
    }
    const p=this.proposals.find(p=>p.id===b.dataset.id);if(!p)return;
    if(action==='approve'||action==='cancel'||action==='withdraw') {
      const slot=Number(b.dataset.slot);
      this.openModal(action==='approve'?'Valider ce créneau ?':action==='cancel'?'Annuler cette proposition ?':'Retirer votre accord ?',`<p><strong>${esc(p.body.title)}</strong></p>${action==='approve'?`<p>${esc(slotLabel(p.body.slots[slot]))}</p><p>Si l’autre membre a choisi ce même horaire, votre accord créera le rendez-vous dans Google.</p>`:'<p>Aucun rendez-vous ne sera créé à partir de cet accord retiré. Une création déjà engagée ne peut plus être annulée ici.</p>'}<div class="form-footer"><button class="btn" data-action="close">Retour</button><button class="btn primary" data-proposal="commit" data-id="${p.id}" data-version="${p.version}" data-choice="${action}" ${action==='approve'?`data-slot="${slot}"`:''}>${action==='approve'?'Je valide':action==='cancel'?'Annuler la proposition':'Retirer mon accord'}</button></div>`);return;
    }
    const body=action==='retry'?{version:p.version,action:'retry'}:{version:Number(b.dataset.version),action:b.dataset.choice,...(b.dataset.choice==='approve'?{slot:Number(b.dataset.slot)}:{})};
    if(!['retry','commit'].includes(action))return;
    return this.operation(()=>this.request(`/calendar/proposals/${p.id}/actions`,{method:'POST',body}));
  }
}
