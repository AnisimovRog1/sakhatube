import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../server/app.js';

async function createTestApp() {
  const app = buildApp({ jwtSecret: 'a-test-secret-that-is-longer-than-thirty-two-characters', allowDevTokens: true });
  await app.ready();
  return app;
}

async function tokenFor(app, roles) {
  return app.jwt.sign({ sub: 'editor-1', roles });
}

test('health is public and content is protected', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  assert.equal(JSON.parse(health.body).ok, true);
  const content = await app.inject({ method: 'GET', url: '/v1/admin/content' });
  assert.equal(content.statusCode, 401);
  const landing = await app.inject({ method: 'GET', url: '/' });
  assert.equal(landing.statusCode, 200);
  assert.match(landing.body, /SakhaTube/);
  const privateFile = await app.inject({ method: 'GET', url: '/package.json' });
  assert.equal(privateFile.statusCode, 404);
});

test('editor can create content and arrange the home shelf', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const token = await tokenFor(app, ['content_editor']);
  const create = await app.inject({
    method: 'POST',
    url: '/v1/admin/content',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: 'Новая история', kind: 'series', genre: 'Драма', episodes: 6, access: 'subscription' }
  });
  assert.equal(create.statusCode, 201);
  const created = JSON.parse(create.body).item;
  const home = await app.inject({
    method: 'PATCH',
    url: '/v1/admin/home/slots',
    headers: { authorization: `Bearer ${token}` },
    payload: { contentIds: [created.id, 'midnight'] }
  });
  assert.equal(home.statusCode, 200);
  assert.deepEqual(JSON.parse(home.body).items.map((item) => item.id), [created.id, 'midnight']);
});

test('moderator can hide a comment but cannot create a series', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const token = await tokenFor(app, ['moderator']);
  const comment = await app.inject({
    method: 'PATCH',
    url: '/v1/admin/comments/comment-1',
    headers: { authorization: `Bearer ${token}` },
    payload: { status: 'hidden', note: 'Нарушает правила обсуждения' }
  });
  assert.equal(comment.statusCode, 200);
  assert.equal(JSON.parse(comment.body).item.status, 'hidden');
  const create = await app.inject({
    method: 'POST',
    url: '/v1/admin/content',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: 'Нельзя', kind: 'clip', genre: 'Драма' }
  });
  assert.equal(create.statusCode, 403);
});

test('playback event is validated and accepted without exposing admin access', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const invalid = await app.inject({ method: 'POST', url: '/v1/events/playback', payload: { contentId: 'midnight', event: 'first_frame' } });
  assert.equal(invalid.statusCode, 400);
  const accepted = await app.inject({ method: 'POST', url: '/v1/events/playback', payload: { contentId: 'midnight', sessionId: 'abcdef0123456789', event: 'first_frame', positionMs: 0 } });
  assert.equal(accepted.statusCode, 202);
});

test('production refuses a memory store unless preview mode is explicitly enabled', () => {
  assert.throws(() => buildApp({ nodeEnv: 'production', jwtSecret: 'a-production-secret-that-is-longer-than-thirty-two-characters' }), /DATABASE_URL/);
  assert.doesNotThrow(() => buildApp({ nodeEnv: 'production', allowDemoStore: true, jwtSecret: 'a-production-secret-that-is-longer-than-thirty-two-characters' }));
});
