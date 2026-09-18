export class ApiError extends Error {
  constructor(message, status = 0, code = '') { super(message); this.status = status; this.code = code; }
}

export function validateConfig(config) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config?.familyId || '')) {
    throw new Error('Le foyer doit être configuré avant de pouvoir ouvrir Maison.');
  }
  const url = new URL(config.auth?.url);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('La connexion doit utiliser une adresse HTTPS.');
  }
  if (!config.auth.realm || !config.auth.clientId) throw new Error('La connexion reste à configurer.');
  return config;
}

export function createClient({ auth, familyId, fetcher = fetch, timeout = 12000 }) {
  return async (path, { method = 'GET', body, key } = {}) => {
    if (!auth.authenticated) throw new ApiError('Votre session a expiré. Reconnectez-vous.', 401);
    try { await auth.updateToken(30); }
    catch { throw new ApiError('Votre session a expiré. Reconnectez-vous.', 401); }
    if (!auth.authenticated || !auth.token) throw new ApiError('Reconnectez-vous pour continuer.', 401);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetcher('/api/v1' + path, {
        method, credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { authorization: 'Bearer ' + auth.token, 'x-family-id': familyId,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(key ? { 'idempotency-key': key } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      let payload;
      try { payload = await response.json(); }
      catch { throw new ApiError('Réponse du service illisible. Actualisez la liste pour vérifier.', response.ok ? 0 : response.status); }
      if (!response.ok || payload.success !== true) {
        const messages = {401: 'Votre session a expiré. Reconnectez-vous.', 403: 'Ce compte n’a pas accès à ce foyer.',
          409: 'La liste a changé depuis votre dernière lecture. Vérifiez sa nouvelle version avant de recommencer.',
          404: 'Cet article n’est plus disponible.', 400: 'Vérifiez les informations saisies.'};
        throw new ApiError(messages[response.status] || 'Le service est indisponible. Réessayez dans un instant.', response.status, payload.error?.code);
      }
      return payload.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Connexion interrompue. Le résultat de l’envoi est à vérifier.');
    } finally { clearTimeout(timer); }
  };
}

// Only this tab's unsent addition is retained. Tokens are never written to storage.
export class PendingAddition {
  constructor(storage, scope) { this.storage = storage; this.key = 'maison:pending:' + scope; }
  read() {
    const raw = this.storage.getItem(this.key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value.key || !Array.isArray(value.body?.items)) throw new Error('Envoi sauvegardé illisible.');
    return value;
  }
  prepare(body) {
    if (this.read()) throw new Error('Vérifiez d’abord l’ajout en attente.');
    const value = { key: crypto.randomUUID(), body };
    this.storage.setItem(this.key, JSON.stringify(value));
    return value;
  }
  clear() { this.storage.removeItem(this.key); }
  async send(request) {
    const value = this.read();
    if (!value) throw new Error('Aucun envoi à reprendre.');
    const result = await request('/grocery/batch', { method: 'POST', body: value.body, key: value.key });
    this.clear();
    return result;
  }
}

export function civilDate(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function nextDay(day = civilDate()) {
  const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
export function bucket(item, today = civilDate()) {
  if (item.status === 'cancelled') return 'cancelled';
  if (item.status === 'purchased') return 'purchased';
  return item.available_on > today ? 'later' : 'open';
}
