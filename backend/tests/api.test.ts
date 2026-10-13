import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../src/app.js';
// Importing the app loads backend/.env before this configuration is read.
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required for npm test. Set it in backend/.env, or run npm run test:unit.');
if (!new URL(url).pathname.endsWith('_test')) throw new Error('Integration tests require a database name ending in _test.');
const schema = `test_${Date.now()}_${process.pid}`;
const admin = new pg.Pool({connectionString:url});
let now = new Date('2030-05-14T07:00:00Z');
const pool = new pg.Pool({connectionString:url,options:`-c search_path=${schema} -c timezone=UTC`});
const secondPool = new pg.Pool({connectionString:url,options:`-c search_path=${schema} -c timezone=UTC`});
const app = createApp(pool,() => now), secondApp = createApp(secondPool,() => now);
const data = (extra: Record<string,unknown> = {}) => ({roomId:1,title:'Team sync',organizerEmail:'sam@example.com',attendees:2,start:'2030-05-14T10:00:00Z',end:'2030-05-14T11:00:00Z',...extra});
await test('HTTP API with real PostgreSQL', async t => {
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(await readFile(new URL('../src/db/schema.sql',import.meta.url),'utf8'));
    t.beforeEach(async () => { await pool.query('TRUNCATE bookings RESTART IDENTITY'); now = new Date('2030-05-14T07:00:00Z'); });
    await t.test('seed returns the five assignment rooms', async () => {
      const response = await request(app).get('/api/rooms').expect(200);
      assert.deepEqual(response.body.data.map((r: {name:string}) => r.name), ['Atlas','Borealis','Cascade','Delta','Ember']);
    });
    await t.test('create, list, conflict 409, back-to-back, cancel and reuse', async () => {
      const created = await request(app).post('/api/bookings').send(data()).expect(201);
      const list = await request(app).get('/api/bookings?date=2030-05-14&roomId=1').expect(200);
      assert.equal(list.body.data.length,1);
      const conflict = await request(app).post('/api/bookings').send(data({organizerEmail:'other@example.com'})).expect(409);
      assert.equal(conflict.body.error.code,'R7_BOOKING_CONFLICT');
      assert.equal(conflict.body.error.details.conflictingBookingId,created.body.data.id);
      await request(app).post('/api/bookings').send(data({start:'2030-05-14T11:00:00Z',end:'2030-05-14T12:00:00Z'})).expect(201);
      await request(app).delete(`/api/bookings/${created.body.data.id}`).expect(200);
      await request(app).delete(`/api/bookings/${created.body.data.id}`).expect(200);
      await request(app).post('/api/bookings').send(data()).expect(201);
    });
    await t.test('invalid inputs, missing records and malformed JSON use consistent errors', async () => {
      for (const patch of [{title:' '},{attendees:5},{start:'2030-05-14T07:00:00Z',end:'2030-05-14T08:00:00Z'},{start:'2030-05-14T10:01:00Z'}]) {
        const response = await request(app).post('/api/bookings').send(data(patch)).expect(400);
        assert.ok(response.body.error.code);
      }
      await request(app).post('/api/bookings').send(data({roomId:999})).expect(404);
      await request(app).delete('/api/bookings/999').expect(404);
      await request(app).get('/api/bookings?date=2030-02-30').expect(400);
      await request(app).post('/api/bookings').set('Content-Type','application/json').send('{oops').expect(400);
    });
    await t.test('availability is ordered by capacity, ignores cancelled bookings and allows past windows', async () => {
      const booking = await request(app).post('/api/bookings').send(data()).expect(201);
      const path = '/api/availability?date=2030-05-14&start=10:00&end=11:00&minCapacity=2';
      const response = await request(app).get(path).expect(200);
      assert.deepEqual(response.body.data.map((r: {name:string}) => r.name),['Ember','Borealis','Cascade','Delta']);
      await request(app).delete(`/api/bookings/${booking.body.data.id}`).expect(200);
      const after = await request(app).get(path).expect(200);
      assert.deepEqual(after.body.data.map((r: {capacity:number}) => r.capacity),[2,4,8,12,20]);
      await request(app).get(path.replace('2030-05-14','2020-05-14')).expect(200);
      await request(app).get(path.replace('10:00','10:01')).expect(400);
    });
    await t.test('R8 rejects started cancellation; repeated cancellation is still a no-op after start', async () => {
      const first = await request(app).post('/api/bookings').send(data()).expect(201);
      const second = await request(app).post('/api/bookings').send(data({roomId:2})).expect(201);
      await request(app).delete(`/api/bookings/${first.body.data.id}`).expect(200);
      now = new Date('2030-05-14T10:00:00Z');
      await request(app).delete(`/api/bookings/${first.body.data.id}`).expect(200);
      const response = await request(app).delete(`/api/bookings/${second.body.data.id}`).expect(409);
      assert.equal(response.body.error.code,'R8_ALREADY_STARTED');
      await request(app).post('/api/bookings').send(data({start:'2030-05-14T09:00:00Z',end:'2030-05-14T09:30:00Z'})).expect(400);
    });
    await t.test('concurrent overlapping requests through independent app pools: exactly one succeeds', async () => {
      const responses = await Promise.all([
        request(app).post('/api/bookings').send(data()),
        request(secondApp).post('/api/bookings').send(data({organizerEmail:'other@example.com'})),
      ]);
      assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
      assert.equal(responses.find(r=>r.status===409)?.body.error.code,'R7_BOOKING_CONFLICT');
      assert.equal((await pool.query("SELECT count(*)::integer AS count FROM bookings WHERE status='confirmed'")).rows[0].count,1);
    });
    await t.test('R9 concurrent requests across different rooms: only three succeed', async () => {
      const responses = await Promise.all([1,2,3,4].map((roomId,index) => request(index%2 ? secondApp : app).post('/api/bookings').send(data({roomId,organizerEmail:index%2 ? 'SAM@EXAMPLE.COM':'sam@example.com'}))));
      assert.deepEqual(responses.map(r=>r.status).sort(),[201,201,201,409]);
      assert.equal(responses.find(r=>r.status===409)?.body.error.code,'R9_DAILY_LIMIT');
    });
    await t.test('R9 cancellation restores allowance and another UTC day has separate allowance', async () => {
      const responses = [];
      for (const roomId of [1,2,3]) responses.push(await request(app).post('/api/bookings').send(data({roomId})).expect(201));
      await request(app).post('/api/bookings').send(data({roomId:4})).expect(409);
      await request(app).post('/api/bookings').send(data({roomId:4,start:'2030-05-15T10:00:00Z',end:'2030-05-15T11:00:00Z'})).expect(201);
      await request(app).delete(`/api/bookings/${responses[0].body.data.id}`).expect(200);
      await request(app).post('/api/bookings').send(data({roomId:4})).expect(201);
    });
  } finally {
    await pool.end(); await secondPool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
