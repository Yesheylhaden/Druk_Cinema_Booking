import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createDataStore } from '../src/services/data-store.js';

test('API validates movies, persists concurrent writes, joins records, and handles errors', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'druk-cinema-test-'));
  const file = join(directory, 'database.json');
  const store = await createDataStore(file);
  const server = createApp(store);
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (path, method = 'GET', body) => fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  assert.equal((await request('/health')).status, 200);
  assert.equal((await (await request('/movies')).json()).length, 3);
  assert.equal((await request('/movies', 'POST', { title: 'Invalid', runtime: -5 })).status, 400);
  assert.equal((await (await request('/movies')).json()).length, 3);

  const movie = { title: ' New film ', genre: 'Drama', runtime: 120, status: 'Coming soon' };
  const created = await request('/movies', 'POST', movie);
  assert.equal(created.status, 201);
  const saved = await created.json();
  assert.equal(saved.title, 'New film');
  assert.ok(saved.id);
  const updated = await request(`/movies/${saved.id}`, 'PATCH', { status: 'Now showing' });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).status, 'Now showing');
  assert.equal((await request(`/movies/${saved.id}`, 'PATCH', { runtime: 0 })).status, 400);
  assert.equal((await request('/movies/unknown', 'PATCH', { status: 'Coming soon' })).status, 404);
  assert.equal((await createDataStore(file)).read().movies.find(item => item.id === saved.id).status, 'Now showing');

  const concurrent = await Promise.all(Array.from({ length: 4 }, (_, index) =>
    request('/movies', 'POST', { ...movie, title: `Concurrent film ${index}` })));
  assert.ok(concurrent.every(response => response.status === 201));
  assert.equal((await createDataStore(file)).read().movies.length, 8);
  const bookings = await (await request('/bookings')).json();
  assert.equal(bookings[0].movieTitle, 'Sergam');
  assert.equal((await (await request('/showtimes')).json()).length, 3);
  const dashboard = await (await request('/dashboard')).json();
  assert.equal(dashboard.summary.moviesShowing, 4);
  assert.equal(dashboard.summary.revenue, 2700);
  await request('/movies/movie-1', 'PATCH', { status: 'Coming soon' });
  assert.equal((await (await request('/showtimes')).json()).length, 2);
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/bookings', 'POST', {})).status, 405);
  const malformed = await fetch(`${base}/movies`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken'
  });
  assert.equal(malformed.status, 400);
  assert.equal((await fetch(`${base}/movies`, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
  const allowed = await fetch(`${base}/movies`, { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');
});
