import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

function nowIso() {
  return new Date().toISOString();
}

export class InMemoryStore {
  constructor() {
    this.events = [];
    this.groceryItems = [];
    this.syncLogs = [];
  }

  createEvent(payload, familyId = null) {
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
      if (filters.familyId !== undefined && event.family_id !== filters.familyId) return false;
      if (filters.date && event.date !== filters.date) return false;
      if (filters.status && event.status !== filters.status) return false;
      return true;
    });
  }

  getEvent(id, familyId) {
    return this.events.find((event) => event.id === id && (familyId === undefined || event.family_id === familyId)) ?? null;
  }

  updateEvent(id, patch, familyId) {
    const index = this.events.findIndex((event) => event.id === id && (familyId === undefined || event.family_id === familyId));
    if (index === -1) return null;

    const updated = {
      ...this.events[index],
      ...patch,
      updated_at: nowIso()
    };

    this.events[index] = updated;
    return updated;
  }

  deleteEvent(id, familyId) {
    const initialLength = this.events.length;
    this.events = this.events.filter((event) => event.id !== id || (familyId !== undefined && event.family_id !== familyId));
    return this.events.length !== initialLength;
  }

  addGroceryBatch(items, familyId = null) {
    const created = [];

    for (const item of items) {
      const existing = this.groceryItems.find((stored) => {
        const oneDayMs = 24 * 60 * 60 * 1000;
        return (
          stored.family_id === familyId &&
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
        updated_at: nowIso(),
        family_id: familyId
      };
      this.groceryItems.push(record);
      created.push(record);
    }

    return created;
  }

  listGroceries(filters = {}) {
    return this.groceryItems.filter((item) => {
      if (filters.familyId !== undefined && item.family_id !== filters.familyId) return false;
      if (typeof filters.purchased === 'boolean' && item.purchased !== filters.purchased) return false;
      if (filters.category && item.category !== filters.category) return false;
      return true;
    });
  }

  updateGrocery(id, patch, familyId) {
    const index = this.groceryItems.findIndex((item) => item.id === id && (familyId === undefined || item.family_id === familyId));
    if (index === -1) return null;

    const { purchasedBy, ...storedPatch } = patch;
    const purchasedAt = patch.purchased ? nowIso() : null;
    const updated = {
      ...this.groceryItems[index],
      ...storedPatch,
      purchased_at: patch.purchased !== undefined ? purchasedAt : this.groceryItems[index].purchased_at,
      purchased_by: purchasedBy ?? this.groceryItems[index].purchased_by,
      updated_at: nowIso(),
      family_id: familyId
    };

    this.groceryItems[index] = updated;
    return updated;
  }

  deleteGrocery(id, familyId) {
    const initialLength = this.groceryItems.length;
    this.groceryItems = this.groceryItems.filter((item) => item.id !== id || (familyId !== undefined && item.family_id !== familyId));
    return this.groceryItems.length !== initialLength;
  }

  createSyncLog(entry, familyId = null) {
    const record = {
      id: randomUUID(),
      created_at: nowIso(),
      ...entry,
      family_id: familyId
    };

    this.syncLogs.push(record);
    return record;
  }

  listSyncLogs() {
    return [...this.syncLogs].reverse();
  }

  isFamilyMember() {
    return false;
  }
}

function mapEvent(row) {
  if (!row) return null;
  const { event_type, ...rest } = row;
  return {
    ...rest,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    time: typeof row.time === 'string' ? row.time.slice(0, 5) : row.time,
    eventType: event_type,
    family_id: row.family_id ?? null
  };
}

function mapGrocery(row) {
  if (!row) return null;
  return { ...row, family_id: row.family_id ?? null };
}

export class PostgresStore {
  constructor(databaseUrl = process.env.DATABASE_URL) {
    if (!databaseUrl) throw new Error('DATABASE_URL is required');
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async close() {
    await this.pool.end();
  }

  async createEvent(payload, familyId = null) {
    const { rows } = await this.pool.query(
      `insert into events
        (title, date, time, person, description, event_type, location, notes, source, family_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        payload.title,
        payload.date,
        payload.time ?? null,
        payload.person ?? null,
        payload.description ?? null,
        payload.eventType ?? 'family',
        payload.location ?? null,
        payload.notes ?? null,
        payload.source ?? 'alexa',
        familyId
      ]
    );
    return mapEvent(rows[0]);
  }

  async listEvents(filters = {}) {
    const values = [filters.familyId ?? null];
    const conditions = ['family_id is not distinct from $1'];
    if (filters.date) {
      values.push(filters.date);
      conditions.push(`date = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`status = $${values.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const { rows } = await this.pool.query(
      `select * from events ${where} order by date asc, time asc nulls last, created_at asc`,
      values
    );
    return rows.map(mapEvent);
  }

  async getEvent(id, familyId) {
    const { rows } = await this.pool.query('select * from events where id = $1 and family_id is not distinct from $2', [id, familyId ?? null]);
    return mapEvent(rows[0]);
  }

  async updateEvent(id, patch, familyId) {
    const fields = {
      title: patch.title,
      date: patch.date,
      time: patch.time,
      person: patch.person,
      description: patch.description,
      event_type: patch.eventType,
      location: patch.location,
      notes: patch.notes,
      source: patch.source,
      status: patch.status
    };
    const assignments = [];
    const values = [];
    for (const [column, value] of Object.entries(fields)) {
      if (value !== undefined) {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      }
    }
    if (assignments.length === 0) return this.getEvent(id, familyId);
    values.push(id, familyId ?? null);
    const { rows } = await this.pool.query(
      `update events set ${assignments.join(', ')}, updated_at = now()
       where id = $${values.length - 1} and family_id is not distinct from $${values.length} returning *`,
      values
    );
    return mapEvent(rows[0]);
  }

  async deleteEvent(id, familyId) {
    const result = await this.pool.query('delete from events where id = $1 and family_id is not distinct from $2', [id, familyId ?? null]);
    return result.rowCount > 0;
  }

  async addGroceryBatch(items, familyId = null) {
    const created = [];
    for (const item of items) {
      const existing = await this.pool.query(
        `select * from grocery_items
         where lower(name) = lower($1)
           and family_id is not distinct from $2
           and purchased = false
           and created_at >= now() - interval '1 day'
         order by created_at desc limit 1`,
        [item.name, familyId]
      );
      if (existing.rows[0]) {
        const { rows } = await this.pool.query(
          `update grocery_items
           set quantity = coalesce(quantity, 0) + coalesce($1, 1), updated_at = now()
           where id = $2 returning *`,
          [item.quantity ?? 1, existing.rows[0].id]
        );
        created.push(mapGrocery(rows[0]));
        continue;
      }
      const { rows } = await this.pool.query(
        `insert into grocery_items (name, quantity, unit, category, source, family_id)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [item.name, item.quantity ?? null, item.unit ?? null, item.category ?? null, item.source ?? 'alexa', familyId]
      );
      created.push(mapGrocery(rows[0]));
    }
    return created;
  }

  async listGroceries(filters = {}) {
    const values = [filters.familyId ?? null];
    const conditions = ['family_id is not distinct from $1'];
    if (typeof filters.purchased === 'boolean') {
      values.push(filters.purchased);
      conditions.push(`purchased = $${values.length}`);
    }
    if (filters.category) {
      values.push(filters.category);
      conditions.push(`category = $${values.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const { rows } = await this.pool.query(
      `select * from grocery_items ${where} order by purchased asc, created_at asc`,
      values
    );
    return rows.map(mapGrocery);
  }

  async updateGrocery(id, patch, familyId) {
    const { purchasedBy, ...rest } = patch;
    const fields = { ...rest };
    if (purchasedBy !== undefined) fields.purchased_by = purchasedBy;
    const assignments = [];
    const values = [];
    for (const [column, value] of Object.entries(fields)) {
      if (value !== undefined) {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      }
    }
    if (patch.purchased !== undefined) {
      values.push(patch.purchased ? 'now()' : null);
      const expression = patch.purchased ? 'now()' : 'null';
      values.pop();
      assignments.push(`purchased_at = ${expression}`);
    }
    if (assignments.length === 0) return this.getGrocery(id, familyId);
    values.push(id, familyId ?? null);
    const { rows } = await this.pool.query(
      `update grocery_items set ${assignments.join(', ')}, updated_at = now()
       where id = $${values.length - 1} and family_id is not distinct from $${values.length} returning *`,
      values
    );
    return mapGrocery(rows[0]);
  }

  async getGrocery(id, familyId) {
    const { rows } = await this.pool.query('select * from grocery_items where id = $1 and family_id is not distinct from $2', [id, familyId ?? null]);
    return mapGrocery(rows[0]);
  }

  async deleteGrocery(id, familyId) {
    const result = await this.pool.query('delete from grocery_items where id = $1 and family_id is not distinct from $2', [id, familyId ?? null]);
    return result.rowCount > 0;
  }

  async createSyncLog(entry, familyId = null) {
    const { rows } = await this.pool.query(
      `insert into sync_logs
        (entity_type, entity_id, service, action, status, error_message, response_data, family_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [
        entry.entity_type,
        entry.entity_id && /^[0-9a-f-]{36}$/i.test(entry.entity_id) ? entry.entity_id : randomUUID(),
        entry.service,
        entry.action,
        entry.status,
        entry.error_message ?? null,
        entry.response_data ?? null,
        familyId
      ]
    );
    return rows[0];
  }

  async listSyncLogs(familyId, limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const { rows } = await this.pool.query(
      `select * from sync_logs
       where family_id is not distinct from $1
       order by created_at desc limit $2`,
      [familyId ?? null, safeLimit]
    );
    return rows;
  }

  async claimNextSyncJob(workerId) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(
        `select * from sync_logs
         where status in ('pending', 'retry')
           and next_attempt_at <= now()
           and attempts < max_attempts
         order by created_at asc
         for update skip locked limit 1`
      );
      if (!result.rows[0]) {
        await client.query('commit');
        return null;
      }
      const { rows } = await client.query(
        `update sync_logs
         set status = 'running', attempts = attempts + 1,
             locked_at = now(), locked_by = $1
         where id = $2 returning *`,
        [workerId, result.rows[0].id]
      );
      await client.query('commit');
      return rows[0];
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeSyncJob(id, responseData = null) {
    const { rows } = await this.pool.query(
      `update sync_logs
       set status = 'completed', completed_at = now(), locked_at = null,
           locked_by = null, response_data = $1
       where id = $2 returning *`,
      [responseData, id]
    );
    return rows[0] ?? null;
  }

  async failSyncJob(id, errorMessage) {
    const { rows } = await this.pool.query(
      `update sync_logs
       set status = case when attempts < max_attempts then 'retry' else 'failed' end,
           error_message = $1, next_attempt_at = now() + make_interval(secs => least(3600, power(2, attempts)::int)),
           locked_at = null, locked_by = null
       where id = $2 returning *`,
      [errorMessage, id]
    );
    return rows[0] ?? null;
  }

  async isFamilyMember(userId, familyId) {
    const { rows } = await this.pool.query(
      'select 1 from family_members where user_id = $1 and family_id = $2 limit 1',
      [userId, familyId]
    );
    return rows.length > 0;
  }
}

export function createStore() {
  return process.env.DATABASE_URL ? new PostgresStore() : new InMemoryStore();
}
