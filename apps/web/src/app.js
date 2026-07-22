const apiInput = document.getElementById('apiBaseUrl');
const saveButton = document.getElementById('saveApiBase');
const statusText = document.getElementById('statusText');
const authBaseInput = document.getElementById('authBaseUrl');
const familyIdInput = document.getElementById('familyId');
const authButton = document.getElementById('authButton');
const authStatus = document.getElementById('authStatus');
const eventsList = document.getElementById('eventsList');
const groceryList = document.getElementById('groceryList');
const syncLogsList = document.getElementById('syncLogsList');

const eventForm = document.getElementById('eventForm');
const groceryForm = document.getElementById('groceryForm');
const refreshEventsButton = document.getElementById('refreshEvents');
const refreshGroceriesButton = document.getElementById('refreshGroceries');
const refreshSyncLogsButton = document.getElementById('refreshSyncLogs');

const apiStorageKey = 'family-command-center-api-url';
const authStorageKey = 'family-command-center-auth-url';
const familyStorageKey = 'family-command-center-family-id';
let keycloakClient = null;
let authInitialized = false;
let KeycloakConstructor = null;

function getApiBase() {
  return localStorage.getItem(apiStorageKey) || 'http://localhost:3100';
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle('error', isError);
}

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle('error', isError);
}

function getAuthBase() {
  return localStorage.getItem(authStorageKey) || 'http://localhost:8081';
}

function getFamilyId() {
  return localStorage.getItem(familyStorageKey) || '576fadf8-f7b4-40b9-bf70-90945c2f0dd4';
}

async function loadKeycloakSdk() {
  if (KeycloakConstructor) return;
  try {
    const module = await import('../vendor/keycloak.js');
    KeycloakConstructor = module.default;
  } catch {
    throw new Error('SDK Keycloak introuvable');
  }
}

async function initializeAuth() {
  authBaseInput.value = getAuthBase();
  familyIdInput.value = getFamilyId();
  try {
    await loadKeycloakSdk();
    keycloakClient = new KeycloakConstructor({
      url: authBaseInput.value,
      realm: 'commandement',
      clientId: 'commandement-center'
    });
    const authenticated = await keycloakClient.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false
    });
    authInitialized = true;
    authButton.textContent = authenticated ? 'Se déconnecter' : 'Se connecter';
    setAuthStatus(authenticated ? 'Connecté.' : 'Non connecté.');
    if (authenticated) {
      await Promise.all([loadEvents(), loadGroceries()]);
      setStatus('Données chargées.');
    }
  } catch (error) {
    setAuthStatus(`Auth indisponible : ${error.message}`, true);
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined && !headers['content-type'] && !headers['Content-Type']) {
    headers['content-type'] = 'application/json';
  }
  if (authInitialized && keycloakClient?.authenticated) {
    await keycloakClient.updateToken(30);
    headers.authorization = `Bearer ${keycloakClient.token}`;
    headers['x-family-id'] = familyIdInput.value.trim();
  }
  const response = await fetch(`${getApiBase()}${path}`, {
    headers,
    ...options
  });

  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message || `Erreur API (${response.status})`);
  }

  return payload.data;
}

function renderEvents(items) {
  eventsList.innerHTML = '';

  if (items.length === 0) {
    eventsList.innerHTML = '<li>Aucun événement.</li>';
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${item.title} — ${item.person || 'Famille'} — ${item.date}${item.time ? ` ${item.time}` : ''}`;
    const actions = document.createElement('span');
    actions.className = 'item-actions';
    const editButton = document.createElement('button');
    editButton.className = 'button-small';
    editButton.textContent = 'Modifier';
    editButton.addEventListener('click', async () => {
      const title = window.prompt('Titre de l’événement', item.title);
      if (!title?.trim()) return;
      try {
        await request(`/api/v1/events/${item.id}`, { method: 'PUT', body: JSON.stringify({ title: title.trim() }) });
        await loadEvents();
        setStatus('Événement modifié.');
      } catch (error) { setStatus(error.message, true); }
    });
    const deleteButton = document.createElement('button');
    deleteButton.className = 'button-small button-danger';
    deleteButton.textContent = 'Supprimer';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`Supprimer « ${item.title} » ?`)) return;
      try {
        await request(`/api/v1/events/${item.id}`, { method: 'DELETE' });
        await loadEvents();
        setStatus('Événement supprimé.');
      } catch (error) { setStatus(error.message, true); }
    });
    actions.append(editButton, deleteButton);
    li.append(label, actions);
    eventsList.appendChild(li);
  }
}

function renderGroceries(items) {
  groceryList.innerHTML = '';

  if (items.length === 0) {
    groceryList.innerHTML = '<li>Aucune course.</li>';
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${item.name}${item.quantity ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ''})` : ''}${item.purchased ? ' ✅' : ''}`;
    const actions = document.createElement('span');
    actions.className = 'item-actions';
    const purchaseButton = document.createElement('button');
    purchaseButton.className = 'button-small';
    purchaseButton.textContent = item.purchased ? 'Rouvrir' : 'Acheté';
    purchaseButton.addEventListener('click', async () => {
      try {
        await request(`/api/v1/grocery/${item.id}`, { method: 'PUT', body: JSON.stringify({ purchased: !item.purchased, purchasedBy: 'dashboard' }) });
        await loadGroceries();
        setStatus(item.purchased ? 'Article rouvert.' : 'Article marqué comme acheté.');
      } catch (error) { setStatus(error.message, true); }
    });
    const deleteButton = document.createElement('button');
    deleteButton.className = 'button-small button-danger';
    deleteButton.textContent = 'Supprimer';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`Supprimer « ${item.name} » ?`)) return;
      try {
        await request(`/api/v1/grocery/${item.id}`, { method: 'DELETE' });
        await loadGroceries();
        setStatus('Article supprimé.');
      } catch (error) { setStatus(error.message, true); }
    });
    actions.append(purchaseButton, deleteButton);
    li.append(label, actions);
    groceryList.appendChild(li);
  }
}

function renderSyncLogs(items) {
  syncLogsList.innerHTML = '';
  if (items.length === 0) {
    syncLogsList.innerHTML = '<li>Aucune synchronisation.</li>';
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    const date = new Date(item.created_at || item.createdAt).toLocaleString('fr-FR');
    li.textContent = `${item.service} — ${item.status} — ${date}`;
    syncLogsList.appendChild(li);
  }
}

async function loadEvents() {
  const items = await request('/api/v1/events');
  renderEvents(items);
}

async function loadGroceries() {
  const items = await request('/api/v1/grocery');
  renderGroceries(items);
}

async function loadSyncLogs() {
  const items = await request('/api/v1/sync/logs');
  renderSyncLogs(items);
}

saveButton.addEventListener('click', () => {
  localStorage.setItem(apiStorageKey, apiInput.value);
  setStatus('URL API sauvegardée.');
});

authButton.addEventListener('click', async () => {
  localStorage.setItem(authStorageKey, authBaseInput.value);
  localStorage.setItem(familyStorageKey, familyIdInput.value.trim());
  try {
    if (!keycloakClient) await initializeAuth();
    if (keycloakClient.authenticated) {
      await keycloakClient.logout({ redirectUri: window.location.href });
    } else {
      await keycloakClient.login({ redirectUri: window.location.href });
    }
  } catch (error) {
    setAuthStatus(error.message, true);
  }
});

eventForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(eventForm);

  const payload = {
    title: formData.get('title'),
    person: formData.get('person') || undefined,
    date: formData.get('date'),
    time: formData.get('time') || undefined,
    location: formData.get('location') || undefined,
    source: 'dashboard'
  };

  try {
    await request('/api/v1/events', { method: 'POST', body: JSON.stringify(payload) });
    setStatus('Événement créé ✅');
    eventForm.reset();
    await loadEvents();
  } catch (error) {
    setStatus(error.message, true);
  }
});

groceryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(groceryForm);
  const quantityRaw = formData.get('quantity');

  const payload = {
    items: [{
      name: formData.get('name'),
      quantity: quantityRaw ? Number(quantityRaw) : undefined,
      unit: formData.get('unit') || undefined,
      category: formData.get('category') || undefined,
      source: 'dashboard'
    }]
  };

  try {
    await request('/api/v1/grocery/batch', { method: 'POST', body: JSON.stringify(payload) });
    setStatus('Course ajoutée ✅');
    groceryForm.reset();
    await loadGroceries();
  } catch (error) {
    setStatus(error.message, true);
  }
});

refreshEventsButton.addEventListener('click', async () => {
  try {
    await loadEvents();
    setStatus('Événements rafraîchis.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

refreshGroceriesButton.addEventListener('click', async () => {
  try {
    await loadGroceries();
    setStatus('Courses rafraîchies.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

refreshSyncLogsButton.addEventListener('click', async () => {
  try {
    await loadSyncLogs();
    setStatus('Historique des synchronisations rafraîchi.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

for (const button of document.querySelectorAll('[data-sync]')) {
  button.addEventListener('click', async () => {
    try {
      await request(`/api/v1/sync/${button.dataset.sync}`, { method: 'POST' });
      await loadSyncLogs();
      setStatus(`Sync ${button.dataset.sync} déclenchée.`);
      window.setTimeout(() => {
        loadSyncLogs().catch((error) => setStatus(error.message, true));
      }, 1500);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

apiInput.value = getApiBase();
initializeAuth();
loadEvents().catch((error) => setStatus(error.message, true));
loadGroceries().catch((error) => setStatus(error.message, true));
loadSyncLogs().catch((error) => setStatus(error.message, true));
