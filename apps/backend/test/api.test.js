import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('POST /api/v1/events creates an event', async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/events',
    payload: {
      title: 'Dentiste',
      date: '2026-04-20',
      time: '15:00',
      person: 'Paul'
    }
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.title, 'Dentiste');
});

test('POST /api/v1/grocery/batch creates items', async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/grocery/batch',
    payload: {
      items: [{ name: 'lait', quantity: 2, unit: 'litres' }]
    }
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.count, 1);
});

test('buildApp creates isolated stores', async (t) => {
  const firstApp = await buildApp();
  const secondApp = await buildApp();
  t.after(async () => {
    await firstApp.close();
    await secondApp.close();
  });

  await firstApp.inject({
    method: 'POST',
    url: '/api/v1/events',
    payload: { title: 'École', date: '2026-04-20' }
  });

  const response = await secondApp.inject({ method: 'GET', url: '/api/v1/events' });
  assert.deepEqual(response.json().data, []);
});

test('event validation rejects invalid time and oversized title', async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/events',
    payload: { title: 'x'.repeat(256), date: '2026-04-20', time: '25:99' }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'VALIDATION_ERROR');
});

test('updating a grocery item maps purchasedBy to purchased_by', async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/grocery/batch',
    payload: { items: [{ name: 'Pain' }] }
  });
  const id = created.json().data.items[0].id;

  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/grocery/${id}`,
    payload: { purchased: true, purchasedBy: 'Paul' }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.purchased_by, 'Paul');
  assert.equal('purchasedBy' in response.json().data, false);
  assert.ok(response.json().data.purchased_at);
});
