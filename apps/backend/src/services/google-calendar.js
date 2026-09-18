import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const ZONE = 'Europe/Paris';
const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
export class CalendarError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
// Resolve a Paris civil time without relying on the server/browser timezone.
// Reject the missing spring hour and the ambiguous autumn hour explicitly.
export function parisInstant(date, time = '00:00') {
  const wanted = `${date} ${time}`;
  const base = Date.parse(`${date}T${time}:00Z`);
  const candidates = [base - 3600000, base - 7200000].filter(ms => formatter.format(new Date(ms)) === wanted);
  if (candidates.length !== 1) throw new CalendarError(400, 'CALENDAR_LOCAL_TIME');
  return new Date(candidates[0]).toISOString();
}
export function followingDay(date) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0,10);
}
export function googleEvent(body) {
  const event = { summary:body.title, location:body.location, description:body.description };
  if (body.allDay) {
    if (body.endDate < body.date) throw new CalendarError(400, 'CALENDAR_END');
    event.start = { date:body.date }; event.end = { date:followingDay(body.endDate) };
  } else {
    const start = parisInstant(body.date, body.time), end = parisInstant(body.endDate, body.endTime);
    if (end <= start) throw new CalendarError(400, 'CALENDAR_END');
    event.start = { dateTime:start, timeZone:ZONE }; event.end = { dateTime:end, timeZone:ZONE };
  }
  return event;
}
const hash = text => createHash('sha256').update(text).digest('hex');
export function displayEvent(event) {
  const hidden = event.visibility === 'private' || !event.summary;
  return { id:event.id, title:hidden ? 'Occupé' : event.summary, start:event.start, end:event.end,
    allDay:!!event.start?.date, private:hidden, recurring:!!event.recurringEventId,
    location:hidden ? '' : event.location ?? '', description:hidden ? '' : event.description ?? '' };
}
export class GoogleCalendar {
  constructor({ credentials, calendarId, familyId, fetcher = fetch }) {
    if (credentials.type !== 'service_account' || !credentials.client_email || credentials.token_uri !== TOKEN_URL ||
        !credentials.private_key || !calendarId || !familyId) throw new Error('Invalid calendar configuration');
    this.credentials = credentials; this.calendarId = calendarId; this.familyId = familyId; this.fetcher = fetcher;
    this.base = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events';
  }
  async token() {
    if (this.cachedToken && this.expiresAt > Date.now() + 60000) return this.cachedToken;
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise = (async () => {
      const key = await importPKCS8(this.credentials.private_key, 'RS256');
      const assertion = await new SignJWT({ scope:SCOPE }).setProtectedHeader({ alg:'RS256', typ:'JWT', kid:this.credentials.private_key_id })
        .setIssuer(this.credentials.client_email).setAudience(TOKEN_URL).setIssuedAt().setExpirationTime('1h').sign(key);
      const result = await this.fetcher(TOKEN_URL, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}), signal:AbortSignal.timeout(7000), redirect:'error' });
      if (!result.ok) throw new CalendarError(503, 'CALENDAR_UNAVAILABLE');
      const body = await result.json();
      if (typeof body.access_token !== 'string' || !Number.isFinite(body.expires_in)) throw new CalendarError(503, 'CALENDAR_UNAVAILABLE');
      this.cachedToken = body.access_token; this.expiresAt = Date.now() + body.expires_in * 1000;
      return this.cachedToken;
    })();
    try { return await this.tokenPromise; } finally { this.tokenPromise = null; }
  }
  async api(url, options = {}) {
    const token = await this.token();
    const result = await this.fetcher(url, { ...options, headers:{ authorization:'Bearer ' + token,
      ...(options.body ? {'content-type':'application/json'} : {}) }, signal:AbortSignal.timeout(7000), redirect:'error' });
    if (result.status === 401) { this.cachedToken = null; throw new CalendarError(503, 'CALENDAR_UNAVAILABLE'); }
    return result;
  }
  async list({ from, to }) {
    let pageToken, events = [];
    for (let page = 0; page < 20; page++) {
      const url = new URL(this.base);
      url.search = new URLSearchParams({ timeMin:parisInstant(from), timeMax:parisInstant(followingDay(to)),
        singleEvents:'true', orderBy:'startTime', showDeleted:'false', maxResults:'250', timeZone:ZONE,
        ...(pageToken ? {pageToken} : {}), fields:'nextPageToken,items(id,status,summary,start,end,visibility,location,description,recurringEventId)' });
      const response = await this.api(url);
      if (!response.ok) throw new CalendarError(503, 'CALENDAR_UNAVAILABLE');
      const body = await response.json();
      events.push(...(body.items ?? []).filter(e => e.status !== 'cancelled').map(displayEvent));
      pageToken = body.nextPageToken;
      if (!pageToken) return { events, from, to, fetchedAt:new Date().toISOString() };
    }
    throw new CalendarError(503, 'CALENDAR_TOO_MANY');
  }
  async create(body, actor, requestKey) {
    const event = googleEvent(body);
    const fingerprint = hash(JSON.stringify(event));
    // Same account + same request key always targets the same Google event, even after a lost response/restart.
    const id = hash(`${this.familyId}:${actor}:${requestKey}`);
    const payload = { ...event, id, extendedProperties:{private:{maisonRequest:fingerprint}} };
    const response = await this.api(this.base + '?sendUpdates=none', { method:'POST', body:JSON.stringify(payload) });
    if (response.status === 409) {
      const existing = await this.api(this.base + '/' + id);
      if (!existing.ok) throw new CalendarError(503, 'CALENDAR_UNAVAILABLE');
      const saved = await existing.json();
      if (saved.status === 'cancelled') throw new CalendarError(409, 'CALENDAR_CANCELLED');
      if (saved.extendedProperties?.private?.maisonRequest !== fingerprint) throw new CalendarError(409, 'CALENDAR_KEY_REUSED');
      return {event:displayEvent(saved), replayed:true};
    }
    if (!response.ok) throw new CalendarError(503, 'CALENDAR_UNAVAILABLE');
    return {event:displayEvent(await response.json()), replayed:false};
  }
}
export function calendarFromEnvironment() {
  const file = process.env.GOOGLE_CALENDAR_CREDENTIALS_FILE;
  const calendarId = process.env.GOOGLE_CALENDAR_ID, familyId = process.env.GOOGLE_CALENDAR_FAMILY_ID;
  if (!file && !calendarId && !familyId) return null;
  if (!file || !calendarId || !familyId) throw new Error('Incomplete calendar configuration');
  return new GoogleCalendar({ credentials:JSON.parse(readFileSync(file,'utf8')), calendarId, familyId });
}
