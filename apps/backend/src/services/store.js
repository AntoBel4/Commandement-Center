import { randomUUID } from 'node:crypto';

function nowIso() {
  return new Date().toISOString();
}

export class InMemoryStore {
  constructor() {
    this.events = [];
    this.groceryItems = [];
    this.syncLogs = [];
  }

  createEvent(payload) {
    const record = {
      id: randomUUID(),
      title: payload.title,
      date: payload.date,
      time: payload.time ?? null,
      person: payload.person ?? null,
      description: payload.description ?? null,
      eventType: payload.eventType ?? 'family',
      location: payload.location ?? null,
      notes: payload.notes ?? null,
      source: payload.source ?? 'alexa',
      status: 'active',
      sync_google: false,
      sync_notion: false,
      sync_telegram: false,
      created_at: nowIso(),
      updated_at: nowIso()
    };

    this.events.push(record);
    return record;
  }

  listEvents(filters = {}) {
    return this.events.filter((event) => {
      if (filters.date && event.date !== filters.date) return false;
      if (filters.status && event.status !== filters.status) return false;
      return true;
    });
  }

  getEvent(id) {
    return this.events.find((event) => event.id === id) ?? null;
  }

  updateEvent(id, patch) {
    const index = this.events.findIndex((event) => event.id === id);
    if (index === -1) return null;

    const updated = {
      ...this.events[index],
      ...patch,
      updated_at: nowIso()
    };

    this.events[index] = updated;
    return updated;
  }

  deleteEvent(id) {
    const initialLength = this.events.length;
    this.events = this.events.filter((event) => event.id !== id);
    return this.events.length !== initialLength;
  }

  addGroceryBatch(items) {
    const created = [];

    for (const item of items) {
      const existing = this.groceryItems.find((stored) => {
        const oneDayMs = 24 * 60 * 60 * 1000;
        return (
          stored.name.toLowerCase() === item.name.toLowerCase() &&
          Date.now() - Date.parse(stored.created_at) <= oneDayMs &&
          stored.purchased === false
        );
      });

      if (existing) {
        existing.quantity = (existing.quantity ?? 0) + (item.quantity ?? 1);
        existing.updated_at = nowIso();
        created.push(existing);
        continue;
      }

      const record = {
        id: randomUUID(),
        name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        category: item.category ?? null,
        purchased: false,
        purchased_at: null,
        purchased_by: null,
        source: item.source ?? 'alexa',
        sync_status: 'pending',
        last_sync_at: null,
        created_at: nowIso(),
        updated_at: nowIso()
      };
      this.groceryItems.push(record);
      created.push(record);
    }

    return created;
  }

  listGroceries(filters = {}) {
    return this.groceryItems.filter((item) => {
      if (typeof filters.purchased === 'boolean' && item.purchased !== filters.purchased) return false;
      if (filters.category && item.category !== filters.category) return false;
      return true;
    });
  }

  updateGrocery(id, patch) {
    const index = this.groceryItems.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const purchasedAt = patch.purchased ? nowIso() : null;
    const updated = {
      ...this.groceryItems[index],
      ...patch,
      purchased_at: patch.purchased !== undefined ? purchasedAt : this.groceryItems[index].purchased_at,
      purchased_by: patch.purchasedBy ?? this.groceryItems[index].purchased_by,
      updated_at: nowIso()
    };

    this.groceryItems[index] = updated;
    return updated;
  }

  deleteGrocery(id) {
    const initialLength = this.groceryItems.length;
    this.groceryItems = this.groceryItems.filter((item) => item.id !== id);
    return this.groceryItems.length !== initialLength;
  }

  createSyncLog(entry) {
    const record = {
      id: randomUUID(),
      created_at: nowIso(),
      ...entry
    };

    this.syncLogs.push(record);
    return record;
  }
}

export const store = new InMemoryStore();
