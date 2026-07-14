import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
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

test('temporary demo media is public but restricted to its own prefix', async (t) => {
  const requestedKeys = [];
  const app = buildApp({
    jwtSecret: 'a-test-secret-that-is-longer-than-thirty-two-characters',
    allowDevTokens: true,
    mediaStore: {
      async get(key, range) {
        requestedKeys.push([key, range]);
        if (range) return { ContentType: 'video/mp4', ContentLength: 16, ContentRange: 'bytes 0-15/32', Body: Readable.from(['demo-video-bytes']) };
        return { ContentType: 'application/vnd.apple.mpegurl', Body: Readable.from(['#EXTM3U\n']) };
      }
    }
  });
  await app.ready();
  t.after(() => app.close());
  const manifest = await app.inject({ method: 'GET', url: '/v1/demo-media/sintel-demo/episode/master.m3u8' });
  assert.equal(manifest.statusCode, 200);
  assert.equal(manifest.headers['content-type'], 'application/vnd.apple.mpegurl');
  assert.equal(manifest.headers['cache-control'], 'no-cache');
  assert.equal(manifest.headers['x-sakhatube-demo-media'], 'true');
  assert.deepEqual(requestedKeys, [['demo-media/sintel-demo/episode/master.m3u8', undefined]]);
  const rangedClip = await app.inject({ method: 'GET', url: '/v1/demo-media/sintel-demo/clip/clip.mp4', headers: { range: 'bytes=0-15' } });
  assert.equal(rangedClip.statusCode, 206);
  assert.equal(rangedClip.headers['accept-ranges'], 'bytes');
  assert.equal(rangedClip.headers['content-range'], 'bytes 0-15/32');
  assert.deepEqual(requestedKeys[1], ['demo-media/sintel-demo/clip/clip.mp4', 'bytes=0-15']);
  const traversal = await app.inject({ method: 'GET', url: '/v1/demo-media/%2E%2E/secret' });
  assert.equal(traversal.statusCode, 404);
});

test('production refuses a memory store unless preview mode is explicitly enabled', () => {
  assert.throws(() => buildApp({ nodeEnv: 'production', jwtSecret: 'a-production-secret-that-is-longer-than-thirty-two-characters' }), /DATABASE_URL/);
  assert.doesNotThrow(() => buildApp({ nodeEnv: 'production', allowDemoStore: true, jwtSecret: 'a-production-secret-that-is-longer-than-thirty-two-characters' }));
});
