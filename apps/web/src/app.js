import { createClient, PendingAddition, validateConfig, civilDate, nextDay, bucket } from './client.js';
import { paths } from './icons.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.bag}"></path></svg>`;
const button = (action, label, extra = '') => `<button class="btn" data-action="${action}" ${extra}>${label}</button>`;
const dateLabel = day => new Date(day + 'T12:00:00Z').toLocaleDateString('fr-FR', {day:'numeric', month:'long', timeZone:'Europe/Paris'});
const state = { view:'home', filter:'open', items:[], ready:false, busy:false, stale:true, updated:null, message:'', fatal:false };
let auth, request, pending, config, person = '', userId = '', toastTimer, undo, seen = new Set(), seenKey, sessionEpoch = 0;
let storageError = false, refreshPromise;
const active = () => state.items.filter(i => bucket(i) === 'open');
const disabled = () => state.busy || state.stale ? 'disabled' : '';
const pendingValue = () => { try { return pending?.read(); } catch { storageError = true; return null; } };

function toast(message, reversal) {
  undo = reversal; clearTimeout(toastTimer);
  $('#toast').innerHTML = esc(message) + (reversal ? '<button data-action="undo">Annuler</button>' : '');
  $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 9000);
}
function notice(message = '', error = false) {
  state.message = message;
  $('#notice').innerHTML = message ? `<div class="banner ${error ? 'notice-error' : ''}">${icon('info')}<span>${esc(message)}</span></div>` : '';
}
function header(title, subtitle, add = true) {
  return `<div class="header row between"><div><div class="eyebrow">Notre espace familial</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${add ? `<button class="btn primary" data-action="add" aria-label="Ajouter une course" ${disabled()}>${icon('plus')}Ajouter une course</button>` : ''}</div>`;
}
function pendingCard() {
  const value = pendingValue();
  if (storageError) return '<div class="banner notice-error">Le stockage de cet onglet est indisponible. Les ajouts sont suspendus pour éviter un doublon après une coupure.</div>';
  return value ? `<section class="card card-pad pending-card"><h3>Un ajout reste à vérifier</h3><p>${esc(value.body.items.map(i => i.name).join(', '))}</p><p>Le serveur peut l’avoir reçu. Reprendre cet envoi permet de vérifier son résultat sans créer un deuxième article.</p><div class="pending-actions">${button('retry-add', 'Reprendre cet envoi', state.busy ? 'disabled' : '')}${button('discard-add', 'Oublier cet envoi', state.busy ? 'disabled' : '')}</div></section>` : '';
}
function grocery(item, compact = false) {
  const kind = bucket(item), purchased = kind === 'purchased';
  const author = item.created_by === userId ? 'Vous' : 'L’autre membre';
  const assigned = item.assigned_to ? (item.assigned_to === userId ? 'Vous vous en occupez' : 'L’autre membre s’en occupe') : '';
  const fresh = !seen.has(item.id) && item.created_by !== userId;
  return `<div class="grocery-item ${purchased ? 'item-done' : ''}" data-item="${esc(item.id)}">
    <button class="check ${purchased ? 'done' : ''}" data-action="buy" data-id="${esc(item.id)}" aria-label="${purchased ? 'Remettre à acheter' : 'Marquer acheté'} : ${esc(item.name)}" ${disabled()}><span>${purchased ? icon('check') : ''}</span></button>
    <div class="item-body"><div class="item-name">${esc(item.name)}${item.urgent ? ' <span class="pill orange">Urgent</span>' : ''}</div>
    <div class="item-meta">${esc([item.quantity, item.unit].filter(v => v !== null && v !== '').join(' ') || 'Quantité à préciser')} · ${author}${kind === 'later' ? ' · Pour le ' + dateLabel(item.available_on) : ''}</div>
    ${assigned ? `<div class="item-meta assigned">${assigned}</div>` : ''}${fresh ? '<span class="new-note">Ajouté depuis votre dernière visite</span>' : ''}</div>
    <div class="item-actions"><button class="btn ghost" data-action="detail" data-id="${esc(item.id)}" aria-label="Options : ${esc(item.name)}" ${disabled()}>${icon('more')}</button></div></div>`;
}
function recapCard() {
  return `<section class="card card-pad recap"><div class="recap-icon">${icon('bag')}</div><div class="eyebrow">On s’organise à deux</div><h2>Qui passe aux courses ?</h2><p>La prise en charge s’affiche sur chaque article. Chacun peut voir ce qu’il reste à faire.</p><button class="btn" data-action="recap" ${disabled()}>Voir le récapitulatif</button><div class="recap-rule">${icon('info')}<span>Le récapitulatif Telegram sera disponible après son raccordement.</span></div></section>`;
}
function agendaCard() {
  return `<section class="card card-pad disabled-card agenda-placeholder"><div class="eyebrow">Notre agenda</div><h2>Vos moments partagés.</h2><p>Le raccordement à Google Agenda reste à préparer. Vos rendez-vous apparaîtront ici une fois la connexion vérifiée.</p><span class="pill neutral">À venir</span></section>`;
}
function home() {
  const items = active();
  return header(`Bonjour ${person}.`, 'Une liste commune, pour avancer ensemble.') + `<div class="dashboard"><div class="stack"><section class="card hero"><div class="hero-copy"><div class="eyebrow">La liste se prépare à deux</div><h2>${items.length ? `${items.length} petite${items.length > 1 ? 's' : ''} chose${items.length > 1 ? 's' : ''}.<br>Une seule liste.` : 'Un peu moins<br>à penser.'}</h2><p>${items.length ? 'Les envies et les petits oublis de chacun, réunis au même endroit.' : 'Votre liste du jour est vide. Ajoutez ce dont vous avez besoin.'}</p><button class="btn light" data-view="shopping">Ouvrir les courses ${icon('arrow')}</button></div><div class="hero-art" aria-hidden="true"><div class="halo"></div><div class="leek"></div><div class="leek two"></div><div class="bread"></div><div class="bag"></div><div class="spark">✧</div></div></section><section class="card card-pad shopping-card"><div class="section-title row between"><h2>À acheter aujourd’hui</h2><span class="pill">${items.length}</span></div>${items.length ? items.slice(0, 4).map(i => grocery(i, true)).join('') : '<div class="empty"><h3>La liste vous attend.</h3><p>Les nouveaux ajouts seront partagés avec le foyer.</p></div>'}${items.length > 4 ? '<button class="btn text" data-view="shopping">Voir toute la liste</button>' : ''}</section></div><div class="stack">${recapCard()}${agendaCard()}</div></div>`;
}
function shopping() {
  const items = state.items.filter(i => bucket(i) === state.filter);
  const groups = [...new Set(items.map(i => i.category || 'Autre'))];
  return header('Les courses.', 'Une envie, un oubli ? Ajoutez-le, c’est partagé.') + `<div class="full-grid"><section><div class="tabs" aria-label="Filtrer les courses">${[['open','À acheter'],['later','Plus tard'],['purchased','Achetés']].map(([id,label]) => `<button data-filter="${id}" class="${state.filter === id ? 'active' : ''}" aria-pressed="${state.filter === id}">${label} · ${state.items.filter(i => bucket(i) === id).length}</button>`).join('')}</div><div class="card card-pad">${items.length ? groups.map(group => `<div class="group-label">${esc(group)}</div>${items.filter(i => (i.category || 'Autre') === group).map(i => grocery(i)).join('')}`).join('') : '<div class="empty"><h3>Rien dans cette liste.</h3><p>Les courses apparaissent ici après leur enregistrement.</p></div>'}</div></section><aside>${recapCard()}</aside></div>`;
}
function settings() {
  return header('À notre façon.', 'Votre compte et les services de la maison.', false) + `<div class="settings-grid"><section class="card card-pad"><h2>Votre espace</h2><div class="setting-row"><div><h3>${esc(person)}</h3><small>Compte personnel · accès au foyer vérifié</small></div><span class="pill">Connecté</span></div><div class="setting-row"><div><h3>Une liste commune</h3><small>Les ajouts et les actions sont enregistrés pour les membres autorisés du foyer.</small></div></div>${button('logout','Se déconnecter')}</section><section class="card card-pad"><h2>Sur votre téléphone</h2><div class="info-line"><div><h3>Retrouver Maison facilement</h3><p>Dans le menu de votre navigateur Android, choisissez « Ajouter à l’écran d’accueil » ou « Installer l’application », si proposé. Ouvrez d’abord l’adresse du portail sur ce téléphone.</p><p>Une connexion au réseau reste nécessaire pour lire et modifier les courses.</p></div></div></section><section class="card card-pad"><h2>Les prochaines connexions</h2>${[['Google Agenda','Rendez-vous partagés et créneaux à valider à deux.'],['Telegram','Récapitulatifs, rappels et journée tranquille personnelle.'],['Alexa','Ajouter une demande avec la voix.']].map(([name,detail]) => `<div class="setting-row"><div><h3>${name}</h3><small>${detail}</small></div><span class="pill neutral">À préparer</span></div>`).join('')}</section></div>`;
}
function render() {
  $('#date').textContent = new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', timeZone:'Europe/Paris'});
  if (!state.ready) return;
  $('#account').textContent = person + ' · Mon compte'; $('#account').disabled = false;
  $('#nav').innerHTML = [['home','home','Aujourd’hui'],['shopping','bag','Courses'],['agenda','calendar','Agenda'],['settings','settings','Réglages']].map(([view,ic,label]) => `<button data-view="${view}" class="${view === state.view ? 'active' : ''}" ${view === state.view ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span>${view === 'shopping' ? `<span class="count">${active().length}</span>` : ''}</button>`).join('');
  const toolbar = `<div class="toolbar"><small>${state.stale ? 'Liste non actualisée · modifications suspendues' : 'Liste actualisée à ' + new Date(state.updated).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}</small>${button('refresh', icon('refresh') + 'Actualiser', state.busy ? 'disabled' : '')}</div>`;
  $('#page').innerHTML = pendingCard() + toolbar + ({home, shopping, settings, agenda: () => header('Notre agenda.', 'Du temps pour l’essentiel.', false) + agendaCard()})[state.view]();
}
function acknowledge() {
  for (const el of document.querySelectorAll('[data-item]')) seen.add(el.dataset.item);
  try { sessionStorage.setItem(seenKey, JSON.stringify([...seen].slice(-2000))); } catch { /* Optional visit hints. */ }
}
function navigate(view) { acknowledge(); state.view = view; render(); $('#page').focus(); window.scrollTo(0,0); }
function openModal(title, body) {
  $('#modal-body').innerHTML = `<div class="section-title row between"><h2 id="modal-title">${esc(title)}</h2><button class="btn ghost icon-btn" data-action="close" aria-label="Fermer">${icon('close')}</button></div>${body}`;
  if (!$('#modal').open) $('#modal').showModal();
  $('#modal input')?.focus();
}
function lockOut(message, forbidden = false) {
  sessionEpoch++; state.ready = false; state.items = []; state.stale = true;
  $('#modal').close(); $('#modal-body').textContent = ''; $('#toast').classList.remove('show'); undo = null;
  $('#nav').innerHTML = ''; $('#account').textContent = forbidden ? 'Changer de compte' : 'Se connecter'; $('#account').disabled = false;
  $('#page').innerHTML = `<section class="card card-pad login-card"><div class="eyebrow">Bienvenue à la maison</div><h1>Le quotidien,<br>ensemble.</h1><p>${esc(message)}</p>${button(forbidden ? 'logout' : 'login', forbidden ? 'Changer de compte' : 'Se connecter')}</section>`;
  notice();
}
async function load() {
  if (refreshPromise) return refreshPromise;
  const epoch = sessionEpoch;
  refreshPromise = (async () => {
    try {
      const items = await request('/grocery');
      if (epoch !== sessionEpoch) return false;
      if (!Array.isArray(items)) throw new Error('La liste reçue est illisible.');
      state.items = items; state.stale = false; state.updated = Date.now();
      if (!state.ready) {
        state.ready = true;
        try {
          const saved = sessionStorage.getItem(seenKey);
          seen = new Set(saved ? JSON.parse(saved) : items.map(i => i.id));
        } catch { seen = new Set(items.map(i => i.id)); }
      }
      notice(); render(); return true;
    } catch (error) {
      if (epoch !== sessionEpoch) return false;
      state.stale = true;
      if ([401,403].includes(error.status)) lockOut(error.message, error.status === 403);
      else {
        if (!state.ready) {
          $('#page').innerHTML = `<section class="card card-pad login-card"><h1>Un instant…</h1><p>La liste n’a pas pu être chargée.</p>${button('refresh','Réessayer')}${button('logout','Se déconnecter')}</section>`;
          $('#account').textContent = 'Mon compte'; $('#account').disabled = false;
        } else render();
        notice(error.message, true);
      }
      return false;
    } finally { refreshPromise = null; }
  })();
  return refreshPromise;
}
function addItem() {
  if (pendingValue()) { toast('Vérifiez d’abord l’ajout en attente.'); return; }
  if (storageError) { toast('Le stockage de cet onglet est indisponible.'); return; }
  openModal('Une chose à ajouter ?', `<form id="item-form"><div class="field"><label for="item-name">De quoi a-t-on besoin ?</label><input id="item-name" name="name" placeholder="Des fraises, du lait…" maxlength="255" required autocomplete="off"></div><div class="two"><div class="field"><label for="item-quantity">Quantité <small>(facultatif)</small></label><input id="item-quantity" name="quantity" type="number" inputmode="decimal" min="0.01" max="99999999.99" step="0.01" placeholder="1"></div><div class="field"><label for="item-unit">Unité</label><input id="item-unit" name="unit" maxlength="50" placeholder="paquet, kg…"></div></div><div class="two"><div class="field"><label for="item-category">Rayon</label><select id="item-category" name="category">${['Fruits & légumes','Frais','Boulangerie','Épicerie','Maison','Autre'].map(s => `<option>${s}</option>`).join('')}</select></div><div class="field"><label for="item-date">Pour quand ?</label><input id="item-date" type="date" name="availableOn" value="${civilDate()}" min="${civilDate()}" max="2100-12-31" required></div></div><label class="checkbox"><input name="urgent" type="checkbox">Signaler comme urgent dans la liste</label><p class="form-note">Ajout avec votre compte. Aucune notification externe n’est encore envoyée.</p><p id="form-error" class="field-error" role="alert"></p><div class="form-footer">${button('close','Fermer')}<button class="btn primary" type="submit">Ajouter à la liste</button></div></form>`);
}
function detail(id) {
  const item = state.items.find(i => i.id === id); if (!item) return;
  openModal(item.name, `<div class="modal-detail"><p>${esc([item.quantity,item.unit].filter(Boolean).join(' ') || 'Quantité à préciser')} · ${esc(item.category || 'Autre')}</p><p>Pour le ${dateLabel(item.available_on)}${item.assigned_to ? '<br>' + (item.assigned_to === userId ? 'Vous vous en occupez.' : 'L’autre membre s’en occupe.') : ''}</p></div><div class="dialog-actions">${button('buy', item.status === 'purchased' ? 'Remettre à acheter' : 'Marquer acheté', `data-id="${id}"`)}${item.status === 'open' ? button('claim', item.assigned_to === userId ? 'Ne plus m’en occuper' : 'Je m’en occupe', `data-id="${id}" ${item.assigned_to && item.assigned_to !== userId ? 'disabled' : ''}`) : ''}${button('schedule','Changer la date', `data-id="${id}"`)}${button('urgent',item.urgent ? 'Retirer l’urgence' : 'Signaler comme urgent', `data-id="${id}"`)}${button('cancel','Retirer de la liste', `data-id="${id}" class="warning"`)}</div><p class="form-note" style="margin-top:18px">L’historique des actions est conservé. L’urgence apparaît dans la liste ; elle n’envoie pas de message.</p>`);
}
function recap() {
  openModal('Les courses à partager.', `<p class="form-note">Récapitulatif de la liste du jour. Aucun envoi Telegram.</p><div class="grocery-list">${active().length ? active().map(i => `<div class="grocery-item"><div class="item-body"><div class="item-name">${esc(i.name)}</div><div class="item-meta">${i.assigned_to ? i.assigned_to === userId ? 'Vous vous en occupez' : 'L’autre membre s’en occupe' : 'À prendre en charge'}</div></div>${button('claim',i.assigned_to === userId ? 'Libérer' : 'Je m’en occupe', `data-id="${i.id}" ${i.assigned_to && i.assigned_to !== userId ? 'disabled' : ''}`)}</div>`).join('') : '<div class="empty">La liste du jour est vide.</div>'}</div>`);
}
async function mutate(item, patch, message, reversal) {
  if (state.busy || state.stale || !state.ready) return;
  const epoch = sessionEpoch;
  state.busy = true; $('#modal').close(); render();
  try {
    const changed = await request('/grocery/' + item.id, {method:'PUT', body:{...patch, version:item.version}});
    if (epoch !== sessionEpoch) return;
    const loaded = await load();
    if (state.ready) toast(message, loaded && reversal ? () => mutate(changed, reversal, 'Action annulée.') : undefined);
  } catch (error) {
    if (epoch !== sessionEpoch) return;
    if ([401,403].includes(error.status)) lockOut(error.message, error.status === 403);
    else { await load(); if (state.ready) notice(error.message + (error.status === 0 ? ' Vérifiez la liste avant de refaire cette action.' : ''), true); }
  } finally { state.busy = false; render(); }
}
async function sendAddition() {
  if (state.busy) return;
  const epoch = sessionEpoch;
  state.busy = true; $('#modal').close(); render();
  try { await pending.send(request); if (epoch !== sessionEpoch) return; state.filter = 'open'; await load(); if (state.ready) toast('Ajout enregistré dans la liste partagée.'); }
  catch (error) {
    if (epoch !== sessionEpoch) return;
    if ([401,403].includes(error.status)) lockOut(error.message, error.status === 403);
    else {
      if (error.status === 400) pending.clear();
      if (!error.status || error.status >= 500) state.stale = true;
      notice(error.message, true);
    }
  } finally { state.busy = false; render(); }
}
async function logout() {
  const authenticated = auth?.authenticated;
  lockOut('Connectez-vous avec votre compte personnel.');
  try { if (authenticated) await auth.logout({redirectUri:location.origin + '/'}); else location.reload(); }
  catch { notice('La déconnexion n’a pas abouti. Réessayez avant de laisser cet appareil.', true); }
}
document.addEventListener('click', async event => {
  const el = event.target.closest('button'); if (!el || el.disabled) return;
  try {
    if (el.dataset.view) { if (state.ready) navigate(el.dataset.view); return; }
    if (el.dataset.filter) { acknowledge(); state.filter = el.dataset.filter; render(); return; }
    const action = el.dataset.action, item = state.items.find(i => i.id === el.dataset.id);
    if (action === 'close') { $('#modal').close(); return; }
    if (action === 'login') { await auth.login({redirectUri:location.origin + '/'}); return; }
    if (action === 'logout') { await logout(); return; }
    if (action === 'refresh') { await load(); return; }
    if (!state.ready || state.busy) return;
    if (action === 'retry-add') { await sendAddition(); return; }
    if (action === 'discard-add') {
      openModal('Oublier cet envoi ?', `<p>Il peut déjà être enregistré sur le serveur. Consultez la liste avant d’ajouter à nouveau le même article.</p><div class="form-footer">${button('close','Garder l’envoi')}${button('confirm-discard','Oublier cet envoi')}</div>`); return;
    }
    if (action === 'confirm-discard') { pending.clear(); $('#modal').close(); await load(); return; }
    if (state.stale) return;
    switch (action) {
      case 'add': addItem(); break;
      case 'detail': detail(el.dataset.id); break;
      case 'recap': recap(); break;
      case 'undo': { const fn = undo; undo = null; $('#toast').classList.remove('show'); if (fn) await fn(); break; }
      case 'buy': if (item) await mutate(item, {status:item.status === 'purchased' ? 'open' : 'purchased'}, item.status === 'purchased' ? 'Remis à acheter.' : 'Article marqué acheté.', {status:item.status}); break;
      case 'claim': if (item && (!item.assigned_to || item.assigned_to === userId)) await mutate(item, {assignedTo:item.assigned_to ? null : userId}, item.assigned_to ? 'Prise en charge libérée.' : 'Le foyer voit que vous vous en occupez.'); break;
      case 'urgent': if (item) await mutate(item, {urgent:!item.urgent}, item.urgent ? 'Urgence retirée.' : 'Urgence signalée dans la liste.'); break;
      case 'schedule': if (item) openModal('Pour quel jour ?', `<form id="schedule-form" data-id="${item.id}" data-version="${item.version}"><label for="reschedule-date">Date des courses</label><input id="reschedule-date" name="date" type="date" value="${nextDay()}" min="${civilDate()}" max="2100-12-31" required><div class="form-footer">${button('close','Fermer')}<button class="btn primary" type="submit">Enregistrer la date</button></div></form>`); break;
      case 'cancel': if (item) openModal('Retirer cet article ?', `<p>${esc(item.name)} sera retiré de la liste. Son historique sera conservé.</p><div class="form-footer">${button('close','Garder')}${button('confirm-cancel','Retirer', `data-id="${item.id}" data-version="${item.version}"`)}</div>`); break;
      case 'confirm-cancel': if (item) await mutate({...item,version:Number(el.dataset.version)}, {status:'cancelled'}, 'Article retiré.', {status:item.status}); break;
    }
  } catch (error) { notice(error.message || 'L’action n’a pas abouti. Réessayez.', true); }
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['item-form','schedule-form'].includes(form.id)) return;
  event.preventDefault(); if (state.busy || state.stale || !state.ready) return;
  const values = Object.fromEntries(new FormData(form));
  if (form.id === 'schedule-form') {
    const item = state.items.find(i => i.id === form.dataset.id);
    if (item) await mutate({...item,version:Number(form.dataset.version)}, {availableOn:values.date}, 'Date des courses enregistrée.');
    return;
  }
  if (!values.name.trim()) { $('#form-error').textContent = 'Ajoutez un nom pour continuer.'; return; }
  try {
    pending.prepare({items:[{name:values.name.trim(), quantity:values.quantity ? Number(values.quantity) : null,
      unit:values.unit.trim() || null, category:values.category, availableOn:values.availableOn, urgent:values.urgent === 'on', source:'dashboard'}]});
    await sendAddition();
  } catch (error) { $('#form-error').textContent = error.message || 'Impossible de préparer cet envoi.'; }
});
$('#account').addEventListener('click', () => {
  if (state.ready) navigate('settings');
  else if (auth?.authenticated) logout();
  else if (auth) auth.login({redirectUri:location.origin + '/'}).catch(() => notice('Connexion indisponible. Réessayez.', true));
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.ready && !state.busy && !$('#modal').open) load(); });
window.addEventListener('online', () => { if (state.ready && !state.busy) load(); });
window.addEventListener('offline', () => { if (state.ready) { state.stale = true; notice('Vous êtes hors connexion. Vos envois en attente restent dans cet onglet.', true); render(); } });
setInterval(() => { if (state.ready && !state.busy && !document.hidden && !$('#modal').open) load(); }, 30000);

async function start() {
  try {
    const response = await fetch('/config.json', {cache:'no-store', signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('La configuration du portail est indisponible.');
    config = validateConfig(await response.json());
    const {default:Keycloak} = await import('../vendor/keycloak.js');
    auth = new Keycloak(config.auth);
    auth.onAuthLogout = () => lockOut('Votre session est terminée. Reconnectez-vous.');
    auth.onTokenExpired = () => auth.updateToken(30).catch(() => lockOut('Votre session a expiré. Reconnectez-vous.'));
    const connected = await auth.init({onLoad:'check-sso', pkceMethod:'S256', checkLoginIframe:false, messageReceiveTimeout:5000});
    if (!connected) { lockOut('Connectez-vous pour retrouver les courses de votre foyer.'); return; }
    userId = auth.tokenParsed.sub.toLowerCase();
    person = auth.tokenParsed.given_name || auth.tokenParsed.preferred_username || 'vous';
    request = createClient({auth, familyId:config.familyId});
    seenKey = `maison:seen:${config.familyId}:${userId}`;
    try { pending = new PendingAddition(sessionStorage, `${config.familyId}:${userId}`); pending.read(); }
    catch { storageError = true; }
    await load();
  } catch (error) {
    state.fatal = true; $('#account').textContent = 'Indisponible';
    $('#page').innerHTML = `<section class="card card-pad login-card"><div class="eyebrow">Maison</div><h1>Un instant…</h1><p>${esc(error.message)}</p><p>Si le problème persiste après actualisation, la configuration de Maison doit être vérifiée.</p><a class="btn" href="/">Réessayer</a></section>`;
  }
}
start();
