import { createHash, randomUUID } from 'node:crypto';

export class GroceryError extends Error {
  constructor(code, statusCode, message) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function familyDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.FAMILY_TIMEZONE || 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function batchHash(items, actorId) {
  return createHash('sha256').update(JSON.stringify({ items, actorId })).digest('hex');
}

export function newGrocery(item, familyId, actorId) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(), family_id: familyId, name: item.name,
    quantity: item.quantity ?? null, unit: item.unit ?? null, category: item.category ?? null,
    source: item.source ?? 'dashboard', created_by: actorId,
    available_on: item.availableOn ?? familyDate(), status: 'open', urgent: item.urgent ?? false,
    assigned_to: null, version: 1, purchased: false, purchased_at: null, purchased_by: null,
    sync_status: 'pending', last_sync_at: null, created_at: now, updated_at: now
  };
}

export function changeGrocery(current, patch, actorId) {
  if (patch.version !== current.version) {
    throw new GroceryError('VERSION_CONFLICT', 409, 'Cette course a changé. Rechargez la liste avant de réessayer.');
  }
  const fields = {};
  for (const key of ['name', 'quantity', 'unit', 'category', 'urgent']) {
    if (patch[key] !== undefined) fields[key] = patch[key];
  }
  if (patch.availableOn !== undefined) fields.available_on = patch.availableOn;
  if (patch.assignedTo !== undefined) fields.assigned_to = patch.assignedTo;
  const status = patch.status ?? (patch.purchased === undefined ? current.status : patch.purchased ? 'purchased' : 'open');
  fields.status = status;
  fields.purchased = status === 'purchased';
  if (status !== current.status) {
    fields.purchased_at = status === 'purchased' ? new Date().toISOString() : null;
    fields.purchased_by = status === 'purchased' ? actorId : null;
  }
  if (Object.entries(fields).every(([key, value]) => current[key] === value)) return current;
  return { ...current, ...fields, version: current.version + 1, updated_at: new Date().toISOString() };
}

export function groceryAction(before, after) {
  if (!before) return 'created';
  if (before.status !== after.status) return after.status === 'open' ? 'reopened' : after.status;
  if (before.available_on !== after.available_on) return 'rescheduled';
  if (before.assigned_to !== after.assigned_to) return 'assigned';
  return 'updated';
}
