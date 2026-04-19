const apiInput = document.getElementById('apiBaseUrl');
const saveButton = document.getElementById('saveApiBase');
const statusText = document.getElementById('statusText');
const eventsList = document.getElementById('eventsList');
const groceryList = document.getElementById('groceryList');

const eventForm = document.getElementById('eventForm');
const groceryForm = document.getElementById('groceryForm');
const refreshEventsButton = document.getElementById('refreshEvents');
const refreshGroceriesButton = document.getElementById('refreshGroceries');

const apiStorageKey = 'family-command-center-api-url';

function getApiBase() {
  return localStorage.getItem(apiStorageKey) || 'http://localhost:3000';
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle('error', isError);
}

async function request(path, options = {}) {
  const response = await fetch(`${getApiBase()}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
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
    li.textContent = `${item.title} — ${item.person || 'Famille'} — ${item.date}${item.time ? ` ${item.time}` : ''}`;
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
    li.textContent = `${item.name}${item.quantity ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ''})` : ''}${item.purchased ? ' ✅' : ''}`;
    groceryList.appendChild(li);
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

saveButton.addEventListener('click', () => {
  localStorage.setItem(apiStorageKey, apiInput.value);
  setStatus('URL API sauvegardée.');
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

for (const button of document.querySelectorAll('[data-sync]')) {
  button.addEventListener('click', async () => {
    try {
      await request(`/api/v1/sync/${button.dataset.sync}`, { method: 'POST' });
      setStatus(`Sync ${button.dataset.sync} déclenchée.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

apiInput.value = getApiBase();
loadEvents().catch((error) => setStatus(error.message, true));
loadGroceries().catch((error) => setStatus(error.message, true));
