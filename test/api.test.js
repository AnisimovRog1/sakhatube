import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { buildApp, createMemoryStore } from '../server/app.js';

async function createTestApp(options = {}) {
  const app = buildApp({ jwtSecret: 'a-test-secret-that-is-longer-than-thirty-two-characters', allowDevTokens: true, ...options });
  await app.ready();
  return app;
}

async function tokenFor(app, roles) {
  return app.jwt.sign({ sub: 'editor-1', roles });
}

function publishableCompliance(overrides = {}) {
  return {
    ageRating: '16+',
    rightsBasis: 'contract',
    rightsHolder: 'ООО Правообладатель',
    licenseReference: 'ST-2026-001',
    territories: ['RU', 'KZ'],
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2027-01-01T00:00:00.000Z',
    audioLanguages: ['ru'],
    subtitleLanguages: ['en'],
    ...overrides
  };
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
  const privacy = await app.inject({ method: 'GET', url: '/privacy' });
  assert.equal(privacy.statusCode, 200);
  assert.match(privacy.body, /Политика конфиденциальности/);
});

test('viewer accounts use a scoped session and never expose password hashes', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const registration = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email: 'Viewer@Example.com', password: 'correct-horse-battery-staple', displayName: 'Зритель' }
  });
  assert.equal(registration.statusCode, 201);
  const session = JSON.parse(registration.body);
  assert.equal(session.viewer.email, 'viewer@example.com');
  assert.equal('passwordHash' in session.viewer, false);
  assert.equal(app.jwt.decode(session.accessToken).kind, 'viewer');
  assert.equal(app.jwt.decode(session.accessToken).roles, undefined);

  const profile = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.equal(profile.statusCode, 200);
  assert.equal(JSON.parse(profile.body).viewer.displayName, 'Зритель');

  const admin = await app.inject({ method: 'GET', url: '/v1/admin/content', headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.equal(admin.statusCode, 403);

  const wrongPassword = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'viewer@example.com', password: 'wrong-password-value' } });
  const unknownEmail = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'unknown@example.com', password: 'wrong-password-value' } });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(unknownEmail.statusCode, 401);
  assert.deepEqual(JSON.parse(wrongPassword.body), JSON.parse(unknownEmail.body));

  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'VIEWER@example.com', password: 'correct-horse-battery-staple' } });
  assert.equal(login.statusCode, 200);
  assert.equal(JSON.parse(login.body).viewer.email, 'viewer@example.com');
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

test('public catalog and home expose only published content', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const catalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  assert.equal(catalog.statusCode, 200);
  assert.deepEqual(JSON.parse(catalog.body).items.map((item) => item.id), ['midnight', 'signal']);
  assert.equal(JSON.parse(catalog.body).items[0].ageRating, '16+');
  assert.equal('compliance' in JSON.parse(catalog.body).items[0], false);
  assert.equal('licenseReference' in JSON.parse(catalog.body).items[0], false);

  const hiddenDetail = await app.inject({ method: 'GET', url: '/v1/catalog/floor' });
  assert.equal(hiddenDetail.statusCode, 404);

  const home = await app.inject({ method: 'GET', url: '/v1/catalog/home' });
  assert.equal(home.statusCode, 200);
  const payload = JSON.parse(home.body);
  assert.equal(payload.hero.id, 'midnight');
  assert.deepEqual(payload.shelves, [{ id: 'featured', title: 'Популярное', items: payload.items }]);
  assert.deepEqual(payload.items.map((item) => item.id), ['midnight', 'signal']);
});

test('content lifecycle enforces review, publication roles, reasons, and audit', async (t) => {
  const store = createMemoryStore();
  const app = await createTestApp({ store });
  t.after(() => app.close());
  const editor = await tokenFor(app, ['content_editor']);
  const superadmin = await tokenFor(app, ['superadmin']);

  const bypassCreate = await app.inject({
    method: 'POST',
    url: '/v1/admin/content',
    headers: { authorization: `Bearer ${editor}` },
    payload: { title: 'Материал для релиза', kind: 'series', genre: 'Драма', status: 'published' }
  });
  assert.equal(bypassCreate.statusCode, 400);

  const create = await app.inject({
    method: 'POST',
    url: '/v1/admin/content',
    headers: { authorization: `Bearer ${editor}` },
    payload: { title: 'Материал для релиза', kind: 'series', genre: 'Драма' }
  });
  assert.equal(create.statusCode, 201);
  const created = JSON.parse(create.body).item;
  assert.equal(created.status, 'draft');

  const bypassPatch = await app.inject({
    method: 'PATCH',
    url: `/v1/admin/content/${created.id}`,
    headers: { authorization: `Bearer ${editor}` },
    payload: { status: 'published' }
  });
  assert.equal(bypassPatch.statusCode, 400);

  const submit = await app.inject({
    method: 'POST',
    url: `/v1/admin/content/${created.id}/submit-review`,
    headers: { authorization: `Bearer ${editor}` },
    payload: { note: 'Проверены права и метаданные' }
  });
  assert.equal(submit.statusCode, 200);
  assert.equal(JSON.parse(submit.body).item.status, 'review');

  const forbiddenPublish = await app.inject({
    method: 'POST',
    url: `/v1/admin/content/${created.id}/publish`,
    headers: { authorization: `Bearer ${editor}` },
    payload: {}
  });
  assert.equal(forbiddenPublish.statusCode, 403);

  const publish = await app.inject({
    method: 'POST',
    url: `/v1/admin/content/${created.id}/publish`,
    headers: { authorization: `Bearer ${superadmin}` },
    payload: {}
  });
  assert.equal(publish.statusCode, 409);
  assert.equal(JSON.parse(publish.body).error, 'PUBLISH_BLOCKED_BY_COMPLIANCE');

  const addCompliance = await app.inject({
    method: 'PATCH',
    url: `/v1/admin/content/${created.id}`,
    headers: { authorization: `Bearer ${editor}` },
    payload: { compliance: publishableCompliance() }
  });
  assert.equal(addCompliance.statusCode, 200);

  const verifyRights = await app.inject({
    method: 'POST',
    url: `/v1/admin/content/${created.id}/verify-rights`,
    headers: { authorization: `Bearer ${superadmin}` },
    payload: { reference: 'LEGAL-REVIEW-2026-001' }
  });
  assert.equal(verifyRights.statusCode, 200);
  assert.equal(JSON.parse(verifyRights.body).item.compliance.verifiedBy, 'editor-1');

  const publishAfterCompliance = await app.inject({
    method: 'POST',
    url: `/v1/admin/content/${created.id}/publish`,
    headers: { authorization: `Bearer ${superadmin}` },
    payload: {}
  });
  assert.equal(publishAfterCompliance.statusCode, 200);
  assert.equal(JSON.parse(publishAfterCompliance.body).item.status, 'published');

  const missingReason = await app.inject({
    method: 'POST',
    url: `/v1/admin/content/${created.id}/unpublish`,
    headers: { authorization: `Bearer ${superadmin}` },
    payload: {}
  });
  assert.equal(missingReason.statusCode, 400);

  const unpublish = await app.inject({
    method: 'POST',
    url: `/v1/admin/content/${created.id}/unpublish`,
    headers: { authorization: `Bearer ${superadmin}` },
    payload: { reason: 'Истёк срок показа' }
  });
  assert.equal(unpublish.statusCode, 200);
  assert.equal(JSON.parse(unpublish.body).item.status, 'unpublished');

  const catalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  assert.equal(JSON.parse(catalog.body).items.some((item) => item.id === created.id), false);
  assert.deepEqual(store.listAudit().slice(0, 3).map((item) => item.action), ['content.unpublish', 'content.publish', 'content.rights.verify']);
});

test('superadmin can schedule reviewed content without exposing it early', async (t) => {
  const store = createMemoryStore();
  const app = await createTestApp({ store });
  t.after(() => app.close());
  const editor = await tokenFor(app, ['content_editor']);
  const superadmin = await tokenFor(app, ['superadmin']);
  const create = await app.inject({
    method: 'POST',
    url: '/v1/admin/content',
    headers: { authorization: `Bearer ${editor}` },
    payload: { title: 'Премьера по расписанию', kind: 'trailer', genre: 'Драма', compliance: publishableCompliance() }
  });
  const id = JSON.parse(create.body).item.id;
  const verifyRights = await app.inject({ method: 'POST', url: `/v1/admin/content/${id}/verify-rights`, headers: { authorization: `Bearer ${superadmin}` }, payload: { reference: 'LEGAL-REVIEW-2026-002' } });
  assert.equal(verifyRights.statusCode, 200);
  const submit = await app.inject({ method: 'POST', url: `/v1/admin/content/${id}/submit-review`, headers: { authorization: `Bearer ${editor}` }, payload: {} });
  assert.equal(submit.statusCode, 200);
  const scheduledAt = new Date(Date.now() + 60_000).toISOString();
  const publish = await app.inject({ method: 'POST', url: `/v1/admin/content/${id}/publish`, headers: { authorization: `Bearer ${superadmin}` }, payload: { scheduledAt } });
  assert.equal(publish.statusCode, 200);
  const scheduled = JSON.parse(publish.body).item;
  assert.equal(scheduled.status, 'scheduled');
  assert.equal(scheduled.scheduledAt, scheduledAt);
  const catalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  assert.equal(JSON.parse(catalog.body).items.some((item) => item.id === id), false);

  await store.updateContent(id, { scheduledAt: new Date(Date.now() - 1_000).toISOString() });
  const publishedCatalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  assert.equal(JSON.parse(publishedCatalog.body).items.some((item) => item.id === id), true);
  assert.equal(store.listAudit()[0].action, 'content.publish.scheduled');
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

test('deletion requests require a one-time verification before staff can complete them', async (t) => {
  const store = createMemoryStore();
  const app = await createTestApp({ store });
  t.after(() => app.close());
  const rejected = await app.inject({ method: 'POST', url: '/v1/privacy/deletion-requests', payload: { email: 'viewer@example.com', confirmation: false } });
  assert.equal(rejected.statusCode, 400);

  const accepted = await app.inject({
    method: 'POST',
    url: '/v1/privacy/deletion-requests',
    payload: { email: 'viewer@example.com', accountEmail: 'account@example.com', message: 'Удалить данные', confirmation: true }
  });
  assert.equal(accepted.statusCode, 202);
  const requestId = JSON.parse(accepted.body).requestId;
  const developmentVerification = JSON.parse(accepted.body).developmentVerification;
  assert.match(requestId, /^[0-9a-f-]{36}$/);
  assert.equal(JSON.parse(accepted.body).status, 'awaiting_verification');
  assert.match(developmentVerification.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(store.listAudit()[0].action, 'privacy.deletion_request.create');
  assert.equal(JSON.stringify(store.listAudit()[0]).includes('viewer@example.com'), false);

  const anonymousList = await app.inject({ method: 'GET', url: '/v1/admin/requests' });
  assert.equal(anonymousList.statusCode, 401);
  const support = await tokenFor(app, ['support']);
  const listed = await app.inject({ method: 'GET', url: '/v1/admin/requests?type=deletion&status=awaiting_verification', headers: { authorization: `Bearer ${support}` } });
  assert.equal(listed.statusCode, 200);
  assert.equal(JSON.parse(listed.body).items[0].id, requestId);
  assert.equal('verificationTokenHash' in JSON.parse(listed.body).items[0], false);
  const prematureCompletion = await app.inject({ method: 'PATCH', url: `/v1/admin/requests/${requestId}`, headers: { authorization: `Bearer ${support}` }, payload: { status: 'completed', note: 'Подтверждено' } });
  assert.equal(prematureCompletion.statusCode, 409);
  const verified = await app.inject({ method: 'POST', url: `/v1/privacy/deletion-requests/${requestId}/verify`, payload: { token: developmentVerification.token } });
  assert.equal(verified.statusCode, 200);
  assert.equal(JSON.parse(verified.body).verified, true);
  const replay = await app.inject({ method: 'POST', url: `/v1/privacy/deletion-requests/${requestId}/verify`, payload: { token: developmentVerification.token } });
  assert.equal(replay.statusCode, 400);
  const completed = await app.inject({ method: 'PATCH', url: `/v1/admin/requests/${requestId}`, headers: { authorization: `Bearer ${support}` }, payload: { status: 'completed', note: 'Подтверждено' } });
  assert.equal(completed.statusCode, 200);
  assert.equal(JSON.parse(completed.body).item.status, 'completed');
});

test('production deletion responses never disclose a verification token', async (t) => {
  const store = createMemoryStore();
  const deliveries = [];
  const app = await createTestApp({
    store,
    nodeEnv: 'production',
    allowDemoStore: true,
    allowDevTokens: false,
    publicBaseUrl: 'https://sakhatube.example',
    mailer: async (message) => { deliveries.push(message); }
  });
  t.after(() => app.close());
  const accepted = await app.inject({
    method: 'POST',
    url: '/v1/privacy/deletion-requests',
    payload: { email: 'viewer@example.com', confirmation: true }
  });
  assert.equal(accepted.statusCode, 202);
  const body = JSON.parse(accepted.body);
  assert.equal('developmentVerification' in body, false);
  assert.equal(JSON.stringify(store.getPublicRequest(body.requestId)).includes('viewer@example.com'), true);
  assert.match(store.getPublicRequest(body.requestId).verificationTokenHash, /^[a-f0-9]{64}$/);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].to, 'viewer@example.com');
  assert.match(deliveries[0].verificationUrl, /^https:\/\/sakhatube\.example\/delete-account\?request=/);
});

test('production rejects deletion requests until mail delivery is configured', async (t) => {
  const app = await createTestApp({ nodeEnv: 'production', allowDemoStore: true, allowDevTokens: false });
  t.after(() => app.close());
  const response = await app.inject({
    method: 'POST',
    url: '/v1/privacy/deletion-requests',
    payload: { email: 'viewer@example.com', confirmation: true }
  });
  assert.equal(response.statusCode, 503);
  assert.equal(JSON.parse(response.body).error, 'DELETION_EMAIL_UNAVAILABLE');
});

test('private multipart upload is role-protected, paged, validated, and queued after completion', async (t) => {
  const uploads = [];
  const completed = [];
  const mediaStore = {
    async createMultipartUpload({ storageKey, contentType, metadata }) {
      uploads.push({ storageKey, contentType, metadata });
      return { uploadId: 'upload-demo-1' };
    },
    async presignUploadPart({ storageKey, uploadId, partNumber }) {
      return `https://private-upload.example/${uploadId}/${storageKey}?partNumber=${partNumber}`;
    },
    async completeMultipartUpload(input) { completed.push(input); },
    async abortMultipartUpload() { assert.fail('upload should not be aborted'); }
  };
  const store = createMemoryStore();
  const app = await createTestApp({ mediaStore, store });
  t.after(() => app.close());
  const editor = await tokenFor(app, ['content_editor']);
  const moderator = await tokenFor(app, ['moderator']);

  const unauthenticated = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    payload: { fileName: 'episode.mp4', contentType: 'video/mp4', size: 16 * 1024 * 1024 }
  });
  assert.equal(unauthenticated.statusCode, 401);

  const forbidden = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    headers: { authorization: `Bearer ${moderator}` },
    payload: { fileName: 'episode.mp4', contentType: 'video/mp4', size: 16 * 1024 * 1024 }
  });
  assert.equal(forbidden.statusCode, 403);

  const emptyFile = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    headers: { authorization: `Bearer ${editor}` },
    payload: { fileName: 'episode.mp4', contentType: 'video/mp4', size: 0 }
  });
  assert.equal(emptyFile.statusCode, 400);

  const tooLarge = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    headers: { authorization: `Bearer ${editor}` },
    payload: { fileName: 'episode.mp4', contentType: 'video/mp4', size: 50 * 1024 * 1024 * 1024 + 1 }
  });
  assert.equal(tooLarge.statusCode, 400);

  const unsafe = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    headers: { authorization: `Bearer ${editor}` },
    payload: { fileName: '../episode.exe', contentType: 'application/x-msdownload', size: 1 }
  });
  assert.equal(unsafe.statusCode, 400);

  const missingContent = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    headers: { authorization: `Bearer ${editor}` },
    payload: { fileName: 'episode.mp4', contentType: 'video/mp4', size: 1, contentId: 'missing-content' }
  });
  assert.equal(missingContent.statusCode, 404);

  const init = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    headers: { authorization: `Bearer ${editor}` },
    payload: { fileName: 'episode-final.mp4', contentType: 'video/mp4', size: 20 * 1024 * 1024, contentId: 'midnight' }
  });
  assert.equal(init.statusCode, 201);
  const started = JSON.parse(init.body);
  assert.equal(started.asset.status, 'uploading');
  assert.equal(started.asset.relation, 'source');
  assert.equal(started.asset.contentId, 'midnight');
  assert.equal(started.asset.durationMs, null);
  assert.match(started.asset.storageKey, /^incoming\//);
  assert.equal(started.partSize, 16 * 1024 * 1024);
  assert.equal(started.partCount, 2);
  assert.deepEqual(started.parts.map((part) => part.number), [1, 2]);
  assert.equal(started.nextPartNumber, null);
  assert.equal(uploads.length, 1);

  const invalidComplete = await app.inject({
    method: 'POST',
    url: `/v1/admin/assets/${started.asset.id}/upload-complete`,
    headers: { authorization: `Bearer ${editor}` },
    payload: { parts: [{ number: 1, etag: 'etag-1' }, { number: 1, etag: 'etag-duplicate' }] }
  });
  assert.equal(invalidComplete.statusCode, 400);

  const complete = await app.inject({
    method: 'POST',
    url: `/v1/admin/assets/${started.asset.id}/upload-complete`,
    headers: { authorization: `Bearer ${editor}` },
    payload: { parts: [{ number: 2, etag: 'etag-2' }, { number: 1, etag: 'etag-1' }] }
  });
  assert.equal(complete.statusCode, 200);
  assert.equal(JSON.parse(complete.body).asset.status, 'queued');
  assert.deepEqual(completed[0].parts, [{ number: 1, etag: 'etag-1' }, { number: 2, etag: 'etag-2' }]);
  assert.deepEqual(store.listAudit().slice(0, 3).map((entry) => entry.action), ['media.transcode.queue', 'media.upload.complete', 'media.upload.init']);

  const rawSource = await app.inject({ method: 'GET', url: `/v1/media/${started.asset.id}` });
  assert.equal(rawSource.statusCode, 404);
});

test('multipart upload part URLs are paged instead of returning thousands at once', async (t) => {
  const mediaStore = {
    async createMultipartUpload() { return { uploadId: 'upload-many-parts' }; },
    async presignUploadPart({ partNumber }) { return `https://private-upload.example/part/${partNumber}`; },
    async completeMultipartUpload() {},
    async abortMultipartUpload() {}
  };
  const app = await createTestApp({ mediaStore });
  t.after(() => app.close());
  const editor = await tokenFor(app, ['content_editor']);
  const init = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    headers: { authorization: `Bearer ${editor}` },
    payload: { fileName: 'large-source.webm', contentType: 'video/webm', size: 101 * 16 * 1024 * 1024 }
  });
  assert.equal(init.statusCode, 201);
  const started = JSON.parse(init.body);
  assert.equal(started.partCount, 101);
  assert.equal(started.parts.length, 100);
  assert.equal(started.nextPartNumber, 101);
  const nextPage = await app.inject({
    method: 'GET',
    url: `/v1/admin/assets/${started.asset.id}/upload-parts?from=101&limit=100`,
    headers: { authorization: `Bearer ${editor}` }
  });
  assert.equal(nextPage.statusCode, 200);
  assert.deepEqual(JSON.parse(nextPage.body).parts.map((part) => part.number), [101]);
  assert.equal(JSON.parse(nextPage.body).nextPartNumber, null);
});

test('an editor can abort only an active private multipart upload', async (t) => {
  const aborted = [];
  const mediaStore = {
    async createMultipartUpload() { return { uploadId: 'upload-to-abort' }; },
    async presignUploadPart() { return 'https://private-upload.example/part'; },
    async completeMultipartUpload() {},
    async abortMultipartUpload(input) { aborted.push(input); }
  };
  const store = createMemoryStore();
  const app = await createTestApp({ mediaStore, store });
  t.after(() => app.close());
  const editor = await tokenFor(app, ['content_editor']);
  const init = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    headers: { authorization: `Bearer ${editor}` },
    payload: { fileName: 'cancel-me.mov', contentType: 'video/quicktime', size: 1 }
  });
  const asset = JSON.parse(init.body).asset;

  const abort = await app.inject({
    method: 'POST',
    url: `/v1/admin/assets/${asset.id}/upload-abort`,
    headers: { authorization: `Bearer ${editor}` }
  });
  assert.equal(abort.statusCode, 200);
  const abortedAsset = JSON.parse(abort.body).asset;
  assert.equal(abortedAsset.status, 'aborted');
  assert.ok(abortedAsset.abortedAt);
  assert.equal(abortedAsset.metadata.processingState, 'aborted');
  assert.deepEqual(aborted, [{ storageKey: asset.storageKey, uploadId: 'upload-to-abort' }]);
  assert.equal(store.listAudit()[0].action, 'media.upload.abort');

  const retry = await app.inject({
    method: 'POST',
    url: `/v1/admin/assets/${asset.id}/upload-abort`,
    headers: { authorization: `Bearer ${editor}` }
  });
  assert.equal(retry.statusCode, 409);
  const rawSource = await app.inject({ method: 'GET', url: `/v1/media/${asset.id}` });
  assert.equal(rawSource.statusCode, 404);
});

test('multipart upload does not start without a persistent media store', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const editor = await tokenFor(app, ['content_editor']);
  const init = await app.inject({
    method: 'POST',
    url: '/v1/admin/assets/upload-init',
    headers: { authorization: `Bearer ${editor}` },
    payload: { fileName: 'episode.mp4', contentType: 'video/mp4', size: 1 }
  });
  assert.equal(init.statusCode, 503);
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
  assert.equal(manifest.headers['cross-origin-resource-policy'], 'cross-origin');
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

test('production never exposes demo rights records as commercial catalogue entries', async (t) => {
  const app = buildApp({
    nodeEnv: 'production',
    allowDemoStore: true,
    jwtSecret: 'a-production-secret-that-is-longer-than-thirty-two-characters'
  });
  await app.ready();
  t.after(() => app.close());
  const catalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  assert.equal(catalog.statusCode, 200);
  assert.deepEqual(JSON.parse(catalog.body).items, []);
});

test('production hides paid content until payment validation is configured', async (t) => {
  const store = createMemoryStore();
  const verifiedCompliance = publishableCompliance({
    verifiedAt: '2026-07-16T00:00:00.000Z',
    verifiedBy: 'legal-reviewer-1',
    verificationReference: 'ST-LEGAL-001'
  });
  store.updateContent('midnight', { compliance: verifiedCompliance, access: 'subscription' });
  store.updateContent('signal', { compliance: verifiedCompliance, access: 'free' });
  const app = buildApp({
    nodeEnv: 'production',
    allowDemoStore: true,
    store,
    jwtSecret: 'a-production-secret-that-is-longer-than-thirty-two-characters'
  });
  await app.ready();
  t.after(() => app.close());

  const catalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  assert.deepEqual(JSON.parse(catalog.body).items.map((item) => item.id), ['signal']);
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(JSON.parse(health.body).payments, 'disabled');
});
