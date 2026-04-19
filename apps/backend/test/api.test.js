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
