// API tests. They run against the DEV database in server/.env and delete every poll they create.
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const app = createApp();
const createdIds = [];

// Each supertest "agent" keeps its own cookies, so one agent = one browser session.
const newBrowser = () => request.agent(app);

async function makePoll(question = '[test] Is this a test poll?') {
  const res = await request(app).post('/api/polls').send({ question });
  assert.equal(res.status, 201);
  createdIds.push(res.body.id);
  return res.body;
}

after(async () => {
  await prisma.poll.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe('POST /api/polls', () => {
  test('creates a poll and returns 201', async () => {
    const res = await request(app).post('/api/polls').send({ question: '  [test] Do you like tea?  ' });
    assert.equal(res.status, 201);
    createdIds.push(res.body.id);
    assert.equal(res.body.question, '[test] Do you like tea?'); // trimmed
    assert.deepEqual(
      { yes: res.body.yes, no: res.body.no, yesPercent: res.body.yesPercent, noPercent: res.body.noPercent },
      { yes: 0, no: 0, yesPercent: 0, noPercent: 0 },
    );
  });

  test('rejects bad input with 400', async () => {
    const bodies = [{}, { question: 42 }, { question: '   ' }, { question: 'abc' }, { question: 'x'.repeat(201) }, [1]];
    for (const body of bodies) {
      const res = await request(app).post('/api/polls').send(body);
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
      assert.ok(res.body.error);
    }
  });

  test('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/polls')
      .set('Content-Type', 'application/json')
      .send('{"question": ');
    assert.equal(res.status, 400);
  });
});

describe('GET /api/polls', () => {
  test('lists polls including a newly created one', async () => {
    const poll = await makePoll();
    const res = await request(app).get('/api/polls');
    assert.equal(res.status, 200);
    assert.ok(res.body.some((p) => p.id === poll.id));
  });
});

describe('GET /api/polls/:id', () => {
  test('returns 404 for a poll that does not exist', async () => {
    const res = await request(app).get('/api/polls/2147483647');
    assert.equal(res.status, 404);
  });

  test('returns 400 for an id that is not a positive whole number', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
      const res = await request(app).get(`/api/polls/${id}`);
      assert.equal(res.status, 400, `expected 400 for id ${id}`);
    }
  });
});

describe('POST /api/polls/:id/vote', () => {
  test('records a vote with 201 and returns updated percentages', async () => {
    const poll = await makePoll();
    const res = await newBrowser().post(`/api/polls/${poll.id}/vote`).send({ choice: 'yes' });
    assert.equal(res.status, 201);
    assert.equal(res.body.yes, 1);
    assert.equal(res.body.yesPercent, 100);
    assert.equal(res.body.noPercent, 0);
    assert.equal(res.body.myVote, 'yes');
  });

  test('rejects a second vote from the same browser session with 409', async () => {
    const poll = await makePoll();
    const browser = newBrowser();
    assert.equal((await browser.post(`/api/polls/${poll.id}/vote`).send({ choice: 'yes' })).status, 201);
    const second = await browser.post(`/api/polls/${poll.id}/vote`).send({ choice: 'no' });
    assert.equal(second.status, 409);

    const after = await request(app).get(`/api/polls/${poll.id}`);
    assert.equal(after.body.total, 1); // the second vote was not stored
  });

  test('rejects two simultaneous votes from one session: exactly one wins', async () => {
    const poll = await makePoll();
    const browser = newBrowser();
    // First request just to receive the session cookie.
    await browser.get('/api/polls/' + poll.id);
    const results = await Promise.all(
      [1, 2, 3].map(() => browser.post(`/api/polls/${poll.id}/vote`).send({ choice: 'no' })),
    );
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409]);
  });

  test('different browser sessions can each vote; percentages add up to 100', async () => {
    const poll = await makePoll();
    for (const choice of ['yes', 'yes', 'no']) {
      assert.equal((await newBrowser().post(`/api/polls/${poll.id}/vote`).send({ choice })).status, 201);
    }
    const res = await request(app).get(`/api/polls/${poll.id}`);
    assert.equal(res.body.yes, 2);
    assert.equal(res.body.no, 1);
    assert.equal(res.body.yesPercent, 67);
    assert.equal(res.body.noPercent, 33);
  });

  test('returns 404 when voting on a poll that does not exist', async () => {
    const res = await newBrowser().post('/api/polls/2147483647/vote').send({ choice: 'yes' });
    assert.equal(res.status, 404);
  });

  test('rejects an invalid choice with 400', async () => {
    const poll = await makePoll();
    for (const body of [{}, { choice: 'maybe' }, { choice: true }, { choice: 'YES ' }]) {
      const res = await newBrowser().post(`/api/polls/${poll.id}/vote`).send(body);
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    }
  });

  test('ignores a forged session cookie and issues a fresh one', async () => {
    const res = await request(app).get('/api/polls').set('Cookie', 'poll_sid=not-a-real-id');
    assert.match(res.headers['set-cookie'][0], /^poll_sid=[0-9a-f-]{36}; Path=\/; HttpOnly; SameSite=Lax/);
  });
});
