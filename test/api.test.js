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

async function verifiedViewer(app, { email, displayName }) {
  const registration = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, username: `user-${email.split('@')[0]}`, password: 'correct-horse-battery-staple', displayName }
  });
  assert.equal(registration.statusCode, 202);
  const pending = JSON.parse(registration.body).developmentVerification;
  const verified = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { accountId: pending.accountId, token: pending.token } });
  assert.equal(verified.statusCode, 200);
  return JSON.parse(verified.body);
}

async function acceptCommunityRules(app, viewer) {
  const accepted = await app.inject({
    method: 'POST',
    url: '/v1/community-rules/acceptance',
    headers: { authorization: `Bearer ${viewer.accessToken}` },
    payload: { version: '2026-07-16', accepted: true }
  });
  assert.equal(accepted.statusCode, 200);
  return JSON.parse(accepted.body).viewer;
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
  const verifyEmail = await app.inject({ method: 'GET', url: '/verify-email' });
  assert.equal(verifyEmail.statusCode, 200);
  assert.match(verifyEmail.body, /Подтверди e-mail/);
});

test('viewer accounts require one-time email verification before issuing a scoped session', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const registration = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email: 'Viewer@Example.com', username: 'viewer-login', password: 'correct-horse-battery-staple', displayName: 'Зритель' }
  });
  assert.equal(registration.statusCode, 202);
  const pending = JSON.parse(registration.body);
  assert.equal('accessToken' in pending, false);
  assert.equal(pending.status, 'verification_required');
  assert.equal(pending.developmentVerification.accountId.length, 36);

  const beforeVerification = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'viewer@example.com', password: 'correct-horse-battery-staple' } });
  assert.equal(beforeVerification.statusCode, 401);

  const wrongPassword = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'viewer@example.com', password: 'wrong-password-value' } });
  const unknownEmail = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'unknown@example.com', password: 'wrong-password-value' } });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(unknownEmail.statusCode, 401);
  assert.deepEqual(JSON.parse(wrongPassword.body), JSON.parse(unknownEmail.body));

  const verified = await app.inject({
    method: 'POST',
    url: '/v1/auth/verify-email',
    payload: { accountId: pending.developmentVerification.accountId, token: pending.developmentVerification.token }
  });
  assert.equal(verified.statusCode, 200);
  const session = JSON.parse(verified.body);
  assert.equal(session.viewer.email, 'viewer@example.com');
  assert.match(session.viewer.id, /^ST-[A-F0-9]{12}$/);
  assert.equal(session.viewer.username, 'viewer-login');
  assert.equal('passwordHash' in session.viewer, false);
  assert.equal(app.jwt.decode(session.accessToken).kind, 'viewer');
  assert.equal(typeof app.jwt.decode(session.accessToken).sid, 'string');
  assert.equal(app.jwt.decode(session.accessToken).roles, undefined);

  const profile = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.equal(profile.statusCode, 200);
  assert.equal(JSON.parse(profile.body).viewer.displayName, 'Зритель');

  const admin = await app.inject({ method: 'GET', url: '/v1/admin/content', headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.equal(admin.statusCode, 403);

  const replay = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { accountId: pending.developmentVerification.accountId, token: pending.developmentVerification.token } });
  assert.equal(replay.statusCode, 400);

  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { login: 'VIEWER-LOGIN', password: 'correct-horse-battery-staple' } });
  assert.equal(login.statusCode, 200);
  assert.equal(JSON.parse(login.body).viewer.email, 'viewer@example.com');
});

test('viewer login is unique, case-insensitive, and the public ID does not change between sessions', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const registration = await app.inject({
    method: 'POST', url: '/v1/auth/register',
    payload: { email: 'login@example.com', username: 'My.Login', password: 'correct-horse-battery-staple', displayName: 'Логин' }
  });
  const pending = JSON.parse(registration.body).developmentVerification;
  const verified = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { accountId: pending.accountId, token: pending.token } });
  const first = JSON.parse(verified.body).viewer;
  assert.equal(first.username, 'my.login');
  assert.match(first.id, /^ST-[A-F0-9]{12}$/);

  const repeatedName = await app.inject({
    method: 'POST', url: '/v1/auth/register',
    payload: { email: 'another@example.com', username: 'MY.LOGIN', password: 'correct-horse-battery-staple', displayName: 'Другой' }
  });
  // Registration does not reveal whether a login is already occupied.
  assert.equal(repeatedName.statusCode, 202);
  assert.equal(JSON.parse(repeatedName.body).developmentVerification, undefined);

  const login = await app.inject({
    method: 'POST', url: '/v1/auth/login',
    payload: { login: 'MY.LOGIN', password: 'correct-horse-battery-staple' }
  });
  assert.equal(login.statusCode, 200);
  assert.equal(JSON.parse(login.body).viewer.id, first.id);
});

test('verified Firebase identity exchanges for a SakhaTube session and keeps the public ID stable', async (t) => {
  const firebaseVerifier = async (token) => {
    if (token === 'valid-firebase-token'.padEnd(120, '.')) return { uid: 'firebase-user-42', email: 'firebase@example.com', email_verified: true, name: 'Firebase Viewer' };
    throw Object.assign(new Error('bad token'), { code: 'auth/id-token-expired' });
  };
  const app = await createTestApp({ firebaseVerifier });
  t.after(() => app.close());
  const idToken = 'valid-firebase-token'.padEnd(120, '.');
  const first = await app.inject({ method: 'POST', url: '/v1/auth/firebase/exchange', payload: { idToken, username: 'firebase.viewer' } });
  assert.equal(first.statusCode, 200);
  const firstSession = JSON.parse(first.body);
  assert.equal(firstSession.viewer.username, 'firebase.viewer');
  assert.match(firstSession.viewer.id, /^ST-[A-F0-9]{12}$/);

  const second = await app.inject({ method: 'POST', url: '/v1/auth/firebase/exchange', payload: { idToken } });
  assert.equal(second.statusCode, 200);
  assert.equal(JSON.parse(second.body).viewer.id, firstSession.viewer.id);

  const rejected = await app.inject({ method: 'POST', url: '/v1/auth/firebase/exchange', payload: { idToken: 'bad-firebase-token'.padEnd(120, '.') } });
  assert.equal(rejected.statusCode, 401);
});

test('Firebase exchange links a verified existing account without replacing its username or public ID', async (t) => {
  const firebaseVerifier = async () => ({ uid: 'firebase-linked-user', email: 'linked@example.com', email_verified: true });
  const app = await createTestApp({ firebaseVerifier });
  t.after(() => app.close());
  const registration = await app.inject({
    method: 'POST', url: '/v1/auth/register',
    payload: { email: 'linked@example.com', username: 'original.login', password: 'correct-horse-battery-staple', displayName: 'Оригинал' }
  });
  const pending = JSON.parse(registration.body).developmentVerification;
  const verified = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { accountId: pending.accountId, token: pending.token } });
  const before = JSON.parse(verified.body).viewer;
  const linked = await app.inject({ method: 'POST', url: '/v1/auth/firebase/exchange', payload: { idToken: 'linked-firebase-token'.padEnd(120, '.') } });
  assert.equal(linked.statusCode, 200);
  const after = JSON.parse(linked.body).viewer;
  assert.equal(after.id, before.id);
  assert.equal(after.username, 'original.login');
});

test('Firebase pending registration reserves a username but cannot issue an app session before Firebase e-mail verification', async (t) => {
  const pendingToken = 'firebase-pending-token'.padEnd(120, '.');
  const verifiedToken = 'firebase-now-verified-token'.padEnd(120, '.');
  const firebaseVerifier = async (token) => {
    if (token === pendingToken) return { uid: 'firebase-pending-user', email: 'pending.firebase@example.com', email_verified: false, name: 'Pending Viewer' };
    if (token === verifiedToken) return { uid: 'firebase-pending-user', email: 'pending.firebase@example.com', email_verified: true, name: 'Pending Viewer' };
    throw Object.assign(new Error('bad token'), { code: 'auth/id-token-expired' });
  };
  const app = await createTestApp({ firebaseVerifier });
  t.after(() => app.close());
  const pending = await app.inject({
    method: 'POST', url: '/v1/auth/firebase/register-pending',
    payload: { idToken: pendingToken, username: 'reserved.login', displayName: 'Резерв' }
  });
  assert.equal(pending.statusCode, 201);
  const reserved = JSON.parse(pending.body);
  assert.equal(reserved.status, 'email_verification_required');
  assert.equal(reserved.username, 'reserved.login');
  assert.match(reserved.publicId, /^ST-[A-F0-9]{12}$/);
  assert.equal('accessToken' in reserved, false);

  const premature = await app.inject({ method: 'POST', url: '/v1/auth/firebase/exchange', payload: { idToken: pendingToken } });
  assert.equal(premature.statusCode, 401);
  assert.equal(JSON.parse(premature.body).error, 'FIREBASE_EMAIL_UNVERIFIED');

  const verified = await app.inject({ method: 'POST', url: '/v1/auth/firebase/exchange', payload: { idToken: verifiedToken } });
  assert.equal(verified.statusCode, 200);
  const activated = JSON.parse(verified.body);
  assert.equal(activated.viewer.id, reserved.publicId);
  assert.equal(activated.viewer.username, 'reserved.login');
});

test('viewer refresh tokens rotate once and logout revokes the linked access session', async (t) => {
  const store = createMemoryStore();
  const app = await createTestApp({ store });
  t.after(() => app.close());
  const registration = await app.inject({
    method: 'POST', url: '/v1/auth/register', headers: { 'x-device-name': 'iPhone test' },
    payload: { email: 'sessions@example.com', password: 'correct-horse-battery-staple', displayName: 'Сессии' }
  });
  const pending = JSON.parse(registration.body);
  const verified = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', payload: { accountId: pending.developmentVerification.accountId, token: pending.developmentVerification.token } });
  assert.equal(verified.statusCode, 200);
  const initial = JSON.parse(verified.body);
  assert.equal(initial.expiresIn, 900);
  assert.equal(initial.refreshExpiresIn, 14 * 24 * 60 * 60);
  assert.match(initial.refreshToken, /^[A-Za-z0-9_-]{43}$/);

  const refreshed = await app.inject({
    method: 'POST', url: '/v1/auth/refresh', headers: { 'x-device-name': 'iPhone test' }, payload: { refreshToken: initial.refreshToken }
  });
  assert.equal(refreshed.statusCode, 200);
  const next = JSON.parse(refreshed.body);
  assert.notEqual(next.refreshToken, initial.refreshToken);
  assert.equal(app.jwt.decode(next.accessToken).kind, 'viewer');

  const oldAccess = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${initial.accessToken}` } });
  assert.equal(oldAccess.statusCode, 401);
  const currentAccess = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${next.accessToken}` } });
  assert.equal(currentAccess.statusCode, 200);

  const replay = await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: initial.refreshToken } });
  assert.equal(replay.statusCode, 401);
  const invalidated = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${next.accessToken}` } });
  assert.equal(invalidated.statusCode, 401);

  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'sessions@example.com', password: 'correct-horse-battery-staple' } });
  const relogin = JSON.parse(login.body);
  const logout = await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: { authorization: `Bearer ${relogin.accessToken}` } });
  assert.equal(logout.statusCode, 204);
  const afterLogout = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${relogin.accessToken}` } });
  assert.equal(afterLogout.statusCode, 401);
  assert.equal(JSON.stringify(store.listAudit()).includes(initial.refreshToken), false);
  assert.equal(JSON.stringify(store.listAudit()).includes('refreshTokenHash'), false);
});

test('production never leaks email verification tokens and uses a generic registration response', async (t) => {
  const deliveries = [];
  const app = await createTestApp({
    nodeEnv: 'production',
    allowDemoStore: true,
    allowDevTokens: false,
    publicBaseUrl: 'https://sakhatube.example',
    mailer: async (message) => { deliveries.push(message); }
  });
  t.after(() => app.close());
  const payload = { email: 'viewer@example.com', password: 'correct-horse-battery-staple', displayName: 'Зритель' };
  const created = await app.inject({ method: 'POST', url: '/v1/auth/register', payload });
  assert.equal(created.statusCode, 202);
  assert.equal('developmentVerification' in JSON.parse(created.body), false);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].type, 'sakhatube.email_verification');
  assert.match(deliveries[0].verificationUrl, /^https:\/\/sakhatube\.example\/verify-email\?account=/);
  const existing = await app.inject({ method: 'POST', url: '/v1/auth/register', payload });
  assert.equal(existing.statusCode, 202);
  assert.deepEqual(JSON.parse(existing.body), JSON.parse(created.body));
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
  assert.deepEqual(JSON.parse(catalog.body).items.map((item) => item.id), ['midnight', 'signal', 'cc-shorts']);
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
  assert.deepEqual(payload.banners.map((item) => item.id), ['banner-midnight', 'banner-signal']);
});

test('Studio manages home banners while public home exposes only active published links', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const editor = await tokenFor(app, ['content_editor']);
  const created = await app.inject({
    method: 'POST', url: '/v1/admin/banners', headers: { authorization: `Bearer ${editor}` },
    payload: { contentId: 'signal', eyebrow: 'ВЫБОР', title: 'Тестовый баннер', description: 'Проверка витрины.', cta: 'Открыть', tone: 'poster-three', active: false }
  });
  assert.equal(created.statusCode, 201);
  const item = JSON.parse(created.body).item;
  assert.equal(item.media, null);

  const activate = await app.inject({
    method: 'PATCH', url: `/v1/admin/banners/${item.id}`, headers: { authorization: `Bearer ${editor}` }, payload: { active: true }
  });
  assert.equal(activate.statusCode, 200);

  const publicHome = await app.inject({ method: 'GET', url: '/v1/home' });
  assert.deepEqual(JSON.parse(publicHome.body).banners.map((banner) => banner.id), ['banner-midnight', 'banner-signal', item.id]);

  const reorder = await app.inject({
    method: 'PUT', url: '/v1/admin/banners/order', headers: { authorization: `Bearer ${editor}` },
    payload: { ids: [item.id, 'banner-midnight', 'banner-signal'] }
  });
  assert.equal(reorder.statusCode, 200);
  assert.deepEqual(JSON.parse(reorder.body).items.map((banner) => banner.id), [item.id, 'banner-midnight', 'banner-signal']);

  const unpublish = await app.inject({ method: 'PATCH', url: '/v1/admin/banners/banner-signal', headers: { authorization: `Bearer ${editor}` }, payload: { active: false } });
  assert.equal(unpublish.statusCode, 200);
  const hidden = await app.inject({ method: 'GET', url: '/v1/catalog/home' });
  assert.equal(JSON.parse(hidden.body).banners.some((banner) => banner.id === 'banner-signal'), false);
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

test('verified viewers can submit, report, and delete comments without exposing account identifiers publicly', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const author = await verifiedViewer(app, { email: 'author@example.com', displayName: 'Автор' });
  const reporter = await verifiedViewer(app, { email: 'reporter@example.com', displayName: 'Репортёр' });
  const beforeAcceptance = await app.inject({
    method: 'POST', url: '/v1/content/signal/comments',
    headers: { authorization: `Bearer ${author.accessToken}` },
    payload: { text: 'Этот комментарий пока должен быть отклонён.' }
  });
  assert.equal(beforeAcceptance.statusCode, 403);
  assert.equal(JSON.parse(beforeAcceptance.body).error, 'COMMUNITY_RULES_ACCEPTANCE_REQUIRED');
  const acceptedViewer = await acceptCommunityRules(app, author);
  assert.equal(acceptedViewer.communityRulesVersion, '2026-07-16');
  assert.ok(acceptedViewer.communityRulesAcceptedAt);
  const create = await app.inject({
    method: 'POST', url: '/v1/content/signal/comments',
    headers: { authorization: `Bearer ${author.accessToken}` },
    payload: { text: 'Новый комментарий для модерации.' }
  });
  assert.equal(create.statusCode, 201);
  const pending = JSON.parse(create.body).item;
  assert.equal(pending.status, 'pending');
  assert.equal('authorId' in pending, false);

  const before = await app.inject({ method: 'GET', url: '/v1/content/signal/comments' });
  assert.equal(JSON.parse(before.body).items.some((item) => item.id === pending.id), false);

  const moderator = await tokenFor(app, ['moderator']);
  const approve = await app.inject({ method: 'PATCH', url: `/v1/admin/comments/${pending.id}`, headers: { authorization: `Bearer ${moderator}` }, payload: { status: 'approved' } });
  assert.equal(approve.statusCode, 200);
  const visible = await app.inject({ method: 'GET', url: '/v1/content/signal/comments?limit=10' });
  const visibleItem = JSON.parse(visible.body).items.find((item) => item.id === pending.id);
  assert.equal(visibleItem.authorName, 'Автор');
  assert.equal('authorId' in visibleItem, false);
  assert.equal('status' in visibleItem, false);

  const ownReport = await app.inject({ method: 'POST', url: `/v1/comments/${pending.id}/report`, headers: { authorization: `Bearer ${author.accessToken}` }, payload: { reason: 'spam' } });
  assert.equal(ownReport.statusCode, 409);
  const report = await app.inject({ method: 'POST', url: `/v1/comments/${pending.id}/report`, headers: { authorization: `Bearer ${reporter.accessToken}` }, payload: { reason: 'abuse', note: 'Проверить вручную' } });
  assert.equal(report.statusCode, 202);
  const duplicate = await app.inject({ method: 'POST', url: `/v1/comments/${pending.id}/report`, headers: { authorization: `Bearer ${reporter.accessToken}` }, payload: { reason: 'abuse' } });
  assert.equal(duplicate.statusCode, 409);
  const reports = await app.inject({ method: 'GET', url: '/v1/admin/comment-reports', headers: { authorization: `Bearer ${moderator}` } });
  const staffReport = JSON.parse(reports.body).items.find((item) => item.commentId === pending.id);
  assert.equal(staffReport.reason, 'abuse');
  assert.equal('reporterId' in staffReport, false);

  const selfDelete = await app.inject({ method: 'POST', url: `/v1/comments/${pending.id}/delete`, headers: { authorization: `Bearer ${author.accessToken}` } });
  assert.equal(selfDelete.statusCode, 204);
  const after = await app.inject({ method: 'GET', url: '/v1/content/signal/comments' });
  assert.equal(JSON.parse(after.body).items.some((item) => item.id === pending.id), false);
});

test('viewer blocks hide approved comment authors only for the blocker and can be removed', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());
  const author = await verifiedViewer(app, { email: 'block-author@example.com', displayName: 'Автор для блока' });
  const viewer = await verifiedViewer(app, { email: 'block-viewer@example.com', displayName: 'Зритель для блока' });
  await acceptCommunityRules(app, author);
  const created = await app.inject({
    method: 'POST', url: '/v1/content/signal/comments',
    headers: { authorization: `Bearer ${author.accessToken}` }, payload: { text: 'Комментарий, который можно скрыть.' }
  });
  assert.equal(created.statusCode, 201);
  const comment = JSON.parse(created.body).item;
  const moderator = await tokenFor(app, ['moderator']);
  assert.equal((await app.inject({ method: 'PATCH', url: `/v1/admin/comments/${comment.id}`, headers: { authorization: `Bearer ${moderator}` }, payload: { status: 'approved' } })).statusCode, 200);

  const publicBefore = await app.inject({ method: 'GET', url: '/v1/content/signal/comments' });
  assert.equal(JSON.parse(publicBefore.body).items.some((item) => item.id === comment.id), true);
  const selfBlock = await app.inject({ method: 'POST', url: `/v1/comments/${comment.id}/block`, headers: { authorization: `Bearer ${author.accessToken}` } });
  assert.equal(selfBlock.statusCode, 409);

  const blocked = await app.inject({ method: 'POST', url: `/v1/comments/${comment.id}/block`, headers: { authorization: `Bearer ${viewer.accessToken}` } });
  assert.equal(blocked.statusCode, 201);
  const block = JSON.parse(blocked.body).item;
  assert.equal(block.viewer.displayName, 'Автор для блока');
  assert.equal('blockedId' in block, false);

  const viewerFeed = await app.inject({ method: 'GET', url: '/v1/content/signal/comments', headers: { authorization: `Bearer ${viewer.accessToken}` } });
  assert.equal(JSON.parse(viewerFeed.body).items.some((item) => item.id === comment.id), false);
  const otherFeed = await app.inject({ method: 'GET', url: '/v1/content/signal/comments' });
  assert.equal(JSON.parse(otherFeed.body).items.some((item) => item.id === comment.id), true);
  const listed = await app.inject({ method: 'GET', url: '/v1/viewer/blocks', headers: { authorization: `Bearer ${viewer.accessToken}` } });
  assert.equal(JSON.parse(listed.body).items[0].id, block.id);
  const unblocked = await app.inject({ method: 'DELETE', url: `/v1/viewer/blocks/${block.id}`, headers: { authorization: `Bearer ${viewer.accessToken}` } });
  assert.equal(unblocked.statusCode, 204);
  const viewerFeedAfter = await app.inject({ method: 'GET', url: '/v1/content/signal/comments', headers: { authorization: `Bearer ${viewer.accessToken}` } });
  assert.equal(JSON.parse(viewerFeedAfter.body).items.some((item) => item.id === comment.id), true);
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

test('verified account deletion revokes every session and anonymizes comments and playback data', async (t) => {
  const store = createMemoryStore();
  const app = await createTestApp({ store });
  t.after(() => app.close());
  const session = await verifiedViewer(app, { email: 'erase@example.com', displayName: 'Удаляемый зритель' });
  await acceptCommunityRules(app, session);
  const accountId = app.jwt.decode(session.accessToken).sub;
  const extraSession = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'erase@example.com', password: 'correct-horse-battery-staple' } });
  assert.equal(extraSession.statusCode, 200);
  const comment = await app.inject({
    method: 'POST', url: '/v1/content/signal/comments', headers: { authorization: `Bearer ${session.accessToken}` }, payload: { text: 'Этот текст должен исчезнуть.' }
  });
  assert.equal(comment.statusCode, 201);
  await app.inject({ method: 'POST', url: '/v1/events/playback', payload: { contentId: 'signal', sessionId: 'delete-test-session', event: 'first_frame', viewerId: accountId } });
  const request = await app.inject({ method: 'POST', url: '/v1/privacy/deletion-requests', payload: { email: 'erase@example.com', confirmation: true } });
  const requestBody = JSON.parse(request.body);
  const verified = await app.inject({ method: 'POST', url: `/v1/privacy/deletion-requests/${requestBody.requestId}/verify`, payload: { token: requestBody.developmentVerification.token } });
  assert.equal(verified.statusCode, 200);
  assert.deepEqual(JSON.parse(verified.body), { requestId: requestBody.requestId, status: 'completed', verified: true, deleted: true });
  const account = store.getViewerAccount(accountId);
  assert.equal(account.status, 'deleted');
  assert.match(account.email, /^deleted\+/);
  assert.equal(account.firebaseUid, null);
  assert.equal(store.getComment(JSON.parse(comment.body).item.id).text, '');
  assert.equal(store.getComment(JSON.parse(comment.body).item.id).authorName, 'Удалённый пользователь');
  assert.equal(store.getComment(JSON.parse(comment.body).item.id).status, 'deleted');
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'erase@example.com', password: 'correct-horse-battery-staple' } });
  assert.equal(login.statusCode, 401);
  const refresh = await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: session.refreshToken } });
  assert.equal(refresh.statusCode, 401);
  assert.equal(store.listAudit().some((entry) => entry.action === 'privacy.deletion_request.complete' && entry.entityId === accountId), true);
});

test('verified deletion removes the linked Firebase identity before local anonymisation', async (t) => {
  const store = createMemoryStore();
  const deletedFirebaseUids = [];
  const app = await createTestApp({
    store,
    firebaseUserDeleter: async (uid) => { deletedFirebaseUids.push(uid); }
  });
  t.after(() => app.close());
  const session = await verifiedViewer(app, { email: 'firebase-delete@example.com', displayName: 'Firebase зритель' });
  const accountId = app.jwt.decode(session.accessToken).sub;
  await store.updateViewerAccount(accountId, { firebaseUid: 'firebase-delete-user-42' });
  const request = await app.inject({ method: 'POST', url: '/v1/privacy/deletion-requests', payload: { email: 'firebase-delete@example.com', confirmation: true } });
  const requestBody = JSON.parse(request.body);
  const verified = await app.inject({ method: 'POST', url: `/v1/privacy/deletion-requests/${requestBody.requestId}/verify`, payload: { token: requestBody.developmentVerification.token } });
  assert.equal(verified.statusCode, 200);
  assert.deepEqual(deletedFirebaseUids, ['firebase-delete-user-42']);
  assert.equal(store.getViewerAccount(accountId).status, 'deleted');
});

test('Firebase deletion failure keeps the account and verified request retryable', async (t) => {
  const store = createMemoryStore();
  let shouldFail = true;
  const app = await createTestApp({
    store,
    firebaseUserDeleter: async () => {
      if (shouldFail) throw Object.assign(new Error('Firebase unavailable'), { code: 'auth/internal-error' });
    }
  });
  t.after(() => app.close());
  const session = await verifiedViewer(app, { email: 'firebase-retry@example.com', displayName: 'Повтор' });
  const accountId = app.jwt.decode(session.accessToken).sub;
  await store.updateViewerAccount(accountId, { firebaseUid: 'firebase-retry-user' });
  const request = await app.inject({ method: 'POST', url: '/v1/privacy/deletion-requests', payload: { email: 'firebase-retry@example.com', confirmation: true } });
  const requestBody = JSON.parse(request.body);
  const firstAttempt = await app.inject({ method: 'POST', url: `/v1/privacy/deletion-requests/${requestBody.requestId}/verify`, payload: { token: requestBody.developmentVerification.token } });
  assert.equal(firstAttempt.statusCode, 503);
  assert.equal(JSON.parse(firstAttempt.body).error, 'FIREBASE_DELETION_UNAVAILABLE');
  assert.equal(store.getViewerAccount(accountId).status, 'active');
  shouldFail = false;
  const retry = await app.inject({ method: 'POST', url: `/v1/privacy/deletion-requests/${requestBody.requestId}/verify`, payload: { token: requestBody.developmentVerification.token } });
  assert.equal(retry.statusCode, 200);
  assert.equal(store.getViewerAccount(accountId).status, 'deleted');
  assert.equal(store.listAudit().some((entry) => entry.action === 'privacy.deletion_request.firebase_failed' && entry.entityId === accountId), true);
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

  const listed = await app.inject({
    method: 'GET',
    url: '/v1/admin/assets?limit=10',
    headers: { authorization: `Bearer ${editor}` }
  });
  assert.equal(listed.statusCode, 200);
  const listedAsset = JSON.parse(listed.body).items.find((item) => item.id === started.asset.id);
  assert.equal(listedAsset.status, 'uploading');
  assert.equal(listedAsset.contentId, 'midnight');
  assert.equal('storageKey' in listedAsset, false);
  assert.equal('uploadId' in listedAsset, false);

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

test('playback sessions fail closed and stream only an explicitly ready free HLS rendition', async (t) => {
  const requestedKeys = [];
  const mediaStore = {
    async get(key) {
      requestedKeys.push(key);
      if (key === 'renditions/signal-release/master.m3u8') {
        return { ContentType: 'application/vnd.apple.mpegurl', Body: Readable.from(['#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=600000\nvideo/playlist.m3u8\n']) };
      }
      if (key === 'renditions/signal-release/video/playlist.m3u8') {
        return { ContentType: 'application/vnd.apple.mpegurl', Body: Readable.from(['#EXTM3U\n#EXTINF:4,\nsegment-001.m4s\n']) };
      }
      if (key === 'renditions/signal-release/video/segment-001.m4s') {
        return { ContentType: 'video/iso.segment', Body: Readable.from(['segment']) };
      }
      throw new Error('object missing');
    }
  };
  const store = createMemoryStore();
  const app = await createTestApp({ store, mediaStore });
  t.after(() => app.close());

  const noRendition = await app.inject({ method: 'POST', url: '/v1/playback/sessions', payload: { contentId: 'signal' } });
  assert.equal(noRendition.statusCode, 409);
  assert.equal(JSON.parse(noRendition.body).error, 'PLAYBACK_NOT_READY');

  const rendition = store.createMedia({
    kind: 'hls',
    relation: 'rendition',
    status: 'ready',
    contentId: 'signal',
    storageKey: 'renditions/signal-release/master.m3u8',
    fileName: 'master.m3u8',
    contentType: 'application/vnd.apple.mpegurl',
    size: 123,
    metadata: {
      playback: {
        hls: {
          state: 'ready',
          prefix: 'renditions/signal-release/',
          manifestKey: 'renditions/signal-release/master.m3u8',
          generatedAt: '2026-07-16T00:00:00.000Z'
        }
      }
    }
  });
  const paid = await app.inject({ method: 'POST', url: '/v1/playback/sessions', payload: { contentId: 'midnight' } });
  assert.equal(paid.statusCode, 403);
  assert.equal(JSON.parse(paid.body).error, 'ENTITLEMENT_REQUIRED');

  const granted = await app.inject({ method: 'POST', url: '/v1/playback/sessions', payload: { contentId: 'signal' } });
  assert.equal(granted.statusCode, 201);
  const session = JSON.parse(granted.body);
  assert.equal(typeof session.sessionId, 'string');
  assert.equal(session.expiresIn, 300);
  assert.match(session.manifestUrl, /^\/v1\/playback\/.+\/master\.m3u8$/);
  assert.equal(JSON.stringify(session).includes('renditions/'), false);
  assert.equal(JSON.stringify(session).includes('storageKey'), false);

  const rawAsset = await app.inject({ method: 'GET', url: `/v1/media/${rendition.id}` });
  assert.equal(rawAsset.statusCode, 404);
  const master = await app.inject({ method: 'GET', url: session.manifestUrl });
  assert.equal(master.statusCode, 200);
  assert.equal(master.headers['content-type'], 'application/vnd.apple.mpegurl');
  assert.equal(master.headers['cache-control'], 'no-store');
  const token = session.manifestUrl.split('/')[3];
  const childPlaylist = await app.inject({ method: 'GET', url: `/v1/playback/${token}/video/playlist.m3u8` });
  assert.equal(childPlaylist.statusCode, 200);
  const segment = await app.inject({ method: 'GET', url: `/v1/playback/${token}/video/segment-001.m4s` });
  assert.equal(segment.statusCode, 200);
  assert.deepEqual(requestedKeys, [
    'renditions/signal-release/master.m3u8',
    'renditions/signal-release/video/playlist.m3u8',
    'renditions/signal-release/video/segment-001.m4s'
  ]);

  const traversal = await app.inject({ method: 'GET', url: `/v1/playback/${token}/..%2Fsecret.m3u8` });
  assert.equal(traversal.statusCode, 401);
});

test('playback gateway rejects a ready-looking rendition with external HLS references', async (t) => {
  const store = createMemoryStore();
  const app = await createTestApp({
    store,
    mediaStore: {
      async get() { return { ContentType: 'application/vnd.apple.mpegurl', Body: Readable.from(['#EXTM3U\nhttps://bucket.example/segment.m4s\n']) }; }
    }
  });
  t.after(() => app.close());
  store.createMedia({
    kind: 'hls', relation: 'rendition', status: 'ready', contentId: 'signal',
    storageKey: 'renditions/signal-release/master.m3u8', fileName: 'master.m3u8', contentType: 'application/vnd.apple.mpegurl', size: 1,
    metadata: { playback: { hls: { state: 'ready', prefix: 'renditions/signal-release/', manifestKey: 'renditions/signal-release/master.m3u8' } } }
  });
  const granted = await app.inject({ method: 'POST', url: '/v1/playback/sessions', payload: { contentId: 'signal' } });
  const manifest = await app.inject({ method: 'GET', url: JSON.parse(granted.body).manifestUrl });
  assert.equal(manifest.statusCode, 502);
  assert.equal(JSON.parse(manifest.body).error, 'PLAYBACK_RENDITION_INVALID');
});

test('media worker queue leases a private job once and never exposes it to Studio', async (t) => {
  const store = createMemoryStore();
  const workerToken = 'worker-token-that-is-longer-than-thirty-two-characters';
  const app = await createTestApp({ store, mediaWorkerToken: workerToken });
  t.after(() => app.close());
  const source = store.createMedia({
    kind: 'video_source', relation: 'source', status: 'queued', contentId: 'signal',
    storageKey: 'incoming/2026-07-16/40000000-0000-4000-8000-000000000001/source.mp4',
    fileName: 'episode.mp4', contentType: 'video/mp4', size: 1, metadata: { processingState: 'queued' }
  });
  const job = store.createMediaJob({ sourceAssetId: source.id, contentId: 'signal', sourceKey: source.storageKey, contentType: source.contentType, sizeBytes: source.size });

  const anonymous = await app.inject({ method: 'POST', url: '/v1/internal/media-jobs/claim', payload: { workerId: 'worker-a' } });
  assert.equal(anonymous.statusCode, 401);
  const claim = await app.inject({ method: 'POST', url: '/v1/internal/media-jobs/claim', headers: { 'x-sakhatube-worker-token': workerToken }, payload: { workerId: 'worker-a' } });
  assert.equal(claim.statusCode, 200);
  const claimed = JSON.parse(claim.body).job;
  assert.equal(claimed.jobId, job.id);
  assert.equal(claimed.sourceKey, source.storageKey);
  const secondClaim = await app.inject({ method: 'POST', url: '/v1/internal/media-jobs/claim', headers: { 'x-sakhatube-worker-token': workerToken }, payload: { workerId: 'worker-b' } });
  assert.equal(secondClaim.statusCode, 204);

  const studio = await tokenFor(app, ['content_editor']);
  const assets = await app.inject({ method: 'GET', url: '/v1/admin/assets', headers: { authorization: `Bearer ${studio}` } });
  assert.equal(assets.statusCode, 200);
  assert.equal(JSON.stringify(assets.body).includes(source.storageKey), false);

  const rendition = store.createMedia({
    kind: 'hls', relation: 'rendition', status: 'ready', contentId: 'signal',
    storageKey: 'renditions/internal/master.m3u8', fileName: 'master.m3u8',
    contentType: 'application/vnd.apple.mpegurl', size: 0, durationMs: 1000,
    metadata: { playback: { hls: { state: 'ready', prefix: 'renditions/internal/', manifestKey: 'renditions/internal/master.m3u8' } } }
  });
  const settle = await app.inject({ method: 'POST', url: `/v1/internal/media-jobs/${job.id}/settle`, headers: { 'x-sakhatube-worker-token': workerToken }, payload: { leaseToken: claimed.leaseToken, outcome: 'succeeded', renditionAssetId: rendition.id } });
  assert.equal(settle.statusCode, 200);
  assert.equal(JSON.parse(settle.body).job.status, 'succeeded');
  assert.equal(store.getMedia(source.id).status, 'processed');
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
  const items = JSON.parse(catalog.body).items;
  assert.deepEqual(items.map((item) => item.id), ['cc-shorts']);
  assert.equal(items[0].access, 'free');
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
  assert.deepEqual(JSON.parse(catalog.body).items.map((item) => item.id), ['signal', 'cc-shorts']);
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(JSON.parse(health.body).payments, 'disabled');
});

test('production fails closed when PAYMENTS_ENABLED is requested without a store validator', async (t) => {
  const store = createMemoryStore();
  const verifiedCompliance = publishableCompliance({
    verifiedAt: '2026-07-16T00:00:00.000Z',
    verifiedBy: 'legal-reviewer-1',
    verificationReference: 'ST-LEGAL-002'
  });
  store.updateContent('midnight', { compliance: verifiedCompliance, access: 'subscription' });
  store.updateContent('signal', { compliance: verifiedCompliance, access: 'free' });
  const app = buildApp({
    nodeEnv: 'production',
    allowDemoStore: true,
    paymentsEnabled: true,
    store,
    jwtSecret: 'a-production-secret-that-is-longer-than-thirty-two-characters'
  });
  await app.ready();
  t.after(() => app.close());

  const catalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  assert.deepEqual(JSON.parse(catalog.body).items.map((item) => item.id), ['signal', 'cc-shorts']);
  const health = await app.inject({ method: 'GET', url: '/health' });
  const body = JSON.parse(health.body);
  assert.equal(body.payments, 'disabled');
  assert.equal(body.billing.status, 'blocked_not_implemented');
  assert.equal(body.billing.serverValidation, 'scaffold_fail_closed');
  assert.equal(body.billing.entitlementGrants, 'blocked');
});

test('billing transport is authenticated, validates configuration, and fails closed without granting access', async (t) => {
  const app = await createTestApp({
    appleAppBundleId: 'com.sakhatube.app',
    googlePlayPackageName: 'com.sakhatube.app',
    billingProductCatalogJson: JSON.stringify([{
      productKey: 'premium_monthly', kind: 'subscription',
      appleProductId: 'com.sakhatube.premium.monthly',
      googlePlayProductId: 'premium_monthly', contentScope: 'all_premium',
      territories: ['RU'], active: true
    }])
  });
  t.after(() => app.close());
  const viewer = await verifiedViewer(app, { email: 'billing@example.com', displayName: 'Покупатель' });
  const unauthenticated = await app.inject({ method: 'POST', url: '/v1/billing/ios/transactions', payload: { signedTransaction: 'x'.repeat(200) } });
  assert.equal(unauthenticated.statusCode, 401);

  const apple = await app.inject({
    method: 'POST', url: '/v1/billing/ios/transactions',
    headers: { authorization: `Bearer ${viewer.accessToken}` },
    payload: { signedTransaction: 'signed-storekit-jws.'.repeat(12) }
  });
  assert.equal(apple.statusCode, 503);
  assert.equal(JSON.parse(apple.body).error, 'BILLING_VALIDATION_UNAVAILABLE');

  const android = await app.inject({
    method: 'POST', url: '/v1/billing/android/purchases',
    headers: { authorization: `Bearer ${viewer.accessToken}` },
    payload: { productKey: 'premium_monthly', purchaseToken: 'purchase-token-for-test-only-123456789' }
  });
  assert.equal(android.statusCode, 503);
  assert.equal(JSON.parse(android.body).error, 'BILLING_VALIDATION_UNAVAILABLE');

  const unknownProduct = await app.inject({
    method: 'POST', url: '/v1/billing/android/purchases',
    headers: { authorization: `Bearer ${viewer.accessToken}` },
    payload: { productKey: 'other_monthly', purchaseToken: 'purchase-token-for-test-only-123456789' }
  });
  assert.equal(unknownProduct.statusCode, 400);

  const entitlements = await app.inject({ method: 'GET', url: '/v1/me/entitlements', headers: { authorization: `Bearer ${viewer.accessToken}` } });
  assert.equal(entitlements.statusCode, 200);
  assert.deepEqual(JSON.parse(entitlements.body).items, []);
  const webhook = await app.inject({ method: 'POST', url: '/v1/billing/apple/notifications', payload: { signedPayload: 'not-trusted' } });
  assert.equal(webhook.statusCode, 503);
});

test('billing configuration rejects partial Apple credentials and duplicate store product IDs', () => {
  assert.throws(() => buildApp({
    appleAppStoreIssuerId: 'issuer-only',
    jwtSecret: 'a-test-secret-that-is-longer-than-thirty-two-characters'
  }), /Apple billing credentials/);
  assert.throws(() => buildApp({
    jwtSecret: 'a-test-secret-that-is-longer-than-thirty-two-characters',
    billingProductCatalogJson: JSON.stringify([
      { productKey: 'premium_monthly', kind: 'subscription', appleProductId: 'com.sakhatube.premium', googlePlayProductId: 'premium_monthly', contentScope: 'all_premium', territories: ['RU'], active: true },
      { productKey: 'premium_yearly', kind: 'subscription', appleProductId: 'com.sakhatube.premium', googlePlayProductId: 'premium_yearly', contentScope: 'all_premium', territories: ['RU'], active: true }
    ])
  }), /повторяющиеся product ID/);
});
