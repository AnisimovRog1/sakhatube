import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { z, ZodError } from 'zod';

const roles = ['superadmin', 'content_editor', 'moderator', 'support', 'analyst'];
const contentStatuses = ['draft', 'review', 'scheduled', 'published', 'unpublished', 'archived'];
const contentKinds = ['series', 'episode', 'trailer', 'clip'];
const accessKinds = ['free', 'subscription', 'purchase'];
const commentStatuses = ['pending', 'approved', 'hidden', 'deleted'];
const playbackEvents = ['intent', 'first_frame', 'pause', 'buffer_start', 'buffer_end', 'error', 'complete'];

const now = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));

export const defaultSeed = {
  content: [
    { id: 'midnight', title: 'После полуночи', kind: 'series', genre: 'Драма', synopsis: 'История, в которой одна ночь меняет всё.', status: 'published', access: 'subscription', episodes: 8, views: 128430, likes: 18320, createdAt: '2026-07-10T10:00:00.000Z', updatedAt: '2026-07-14T09:00:00.000Z' },
    { id: 'signal', title: 'Тихий сигнал', kind: 'series', genre: 'Мистика', synopsis: 'Каждый новый сигнал открывает ещё одну тайну.', status: 'published', access: 'free', episodes: 10, views: 96420, likes: 12180, createdAt: '2026-07-09T10:00:00.000Z', updatedAt: '2026-07-14T09:00:00.000Z' },
    { id: 'floor', title: 'Пятый этаж', kind: 'series', genre: 'Триллер', synopsis: 'Черновик нового сериала.', status: 'draft', access: 'subscription', episodes: 6, views: 0, likes: 0, createdAt: '2026-07-14T10:00:00.000Z', updatedAt: '2026-07-14T10:00:00.000Z' }
  ],
  homeSlots: ['midnight', 'signal'],
  comments: [
    { id: 'comment-1', contentId: 'midnight', authorId: 'viewer-1', authorName: 'Мария К.', text: 'Очень жду продолжение. Концовка серии не отпускает.', status: 'pending', createdAt: '2026-07-14T08:30:00.000Z', updatedAt: '2026-07-14T08:30:00.000Z' },
    { id: 'comment-2', contentId: 'signal', authorId: 'viewer-2', authorName: 'Илья Р.', text: 'Когда выйдет следующая серия?', status: 'pending', createdAt: '2026-07-14T08:10:00.000Z', updatedAt: '2026-07-14T08:10:00.000Z' }
  ],
  playback: [],
  audit: []
};

export function createMemoryStore(seed = defaultSeed) {
  const state = clone(seed);

  function findContent(id) {
    return state.content.find((item) => item.id === id);
  }

  return {
    listContent() { return state.content.map(clone); },
    getContent(id) { const item = findContent(id); return item && clone(item); },
    createContent(data) {
      const record = { id: randomUUID(), views: 0, likes: 0, createdAt: now(), updatedAt: now(), ...data };
      state.content.unshift(record);
      return clone(record);
    },
    updateContent(id, patch) {
      const item = findContent(id);
      if (!item) return null;
      Object.assign(item, patch, { updatedAt: now() });
      return clone(item);
    },
    listHomeSlots() { return state.homeSlots.map((id) => findContent(id)).filter(Boolean).map(clone); },
    replaceHomeSlots(ids) { state.homeSlots = [...ids]; return this.listHomeSlots(); },
    listComments(status) { return state.comments.filter((item) => !status || item.status === status).map(clone); },
    updateComment(id, status, moderationNote) {
      const comment = state.comments.find((item) => item.id === id);
      if (!comment) return null;
      Object.assign(comment, { status, moderationNote, updatedAt: now() });
      return clone(comment);
    },
    addPlayback(event) { state.playback.push({ id: randomUUID(), receivedAt: now(), ...event }); },
    overview() {
      const pendingComments = state.comments.filter((item) => item.status === 'pending').length;
      const published = state.content.filter((item) => item.status === 'published').length;
      const firstFrames = state.playback.filter((item) => item.event === 'first_frame').length;
      const bufferStarts = state.playback.filter((item) => item.event === 'buffer_start').length;
      const totalViews = state.content.reduce((sum, item) => sum + item.views, 0) + firstFrames;
      return {
        totalViews,
        totalLikes: state.content.reduce((sum, item) => sum + item.likes, 0),
        pendingComments,
        published,
        firstFrameEvents: firstFrames,
        bufferStartEvents: bufferStarts,
        topContent: state.content.filter((item) => item.status === 'published').sort((a, b) => b.views - a.views).slice(0, 5).map(clone)
      };
    },
    audit(entry) { state.audit.unshift({ id: randomUUID(), at: now(), ...entry }); },
    listAudit() { return state.audit.map(clone); }
  };
}

const contentInput = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(contentKinds),
  genre: z.string().trim().min(1).max(64),
  synopsis: z.string().trim().max(2000).default(''),
  status: z.enum(contentStatuses).default('draft'),
  access: z.enum(accessKinds).default('free'),
  episodes: z.number().int().min(1).max(999).default(1)
});

const contentPatch = contentInput.partial();
const homeSlotsInput = z.object({ contentIds: z.array(z.string().uuid().or(z.string().min(1).max(80))).min(0).max(30).refine((ids) => new Set(ids).size === ids.length, 'Повторять карточки в витрине нельзя') });
const commentActionInput = z.object({ status: z.enum(['approved', 'hidden', 'deleted']), note: z.string().trim().max(500).optional() });
const playbackInput = z.object({
  contentId: z.string().min(1).max(80),
  sessionId: z.string().min(16).max(128),
  event: z.enum(playbackEvents),
  positionMs: z.number().int().min(0).max(86_400_000).optional(),
  errorCode: z.string().trim().max(80).optional()
});

function configFrom(overrides = {}) {
  const production = (overrides.nodeEnv ?? process.env.NODE_ENV) === 'production';
  const jwtSecret = overrides.jwtSecret ?? process.env.JWT_SECRET ?? 'local-development-secret-change-before-production';
  const allowedOrigins = overrides.allowedOrigins ?? (process.env.ALLOWED_ORIGINS || 'http://localhost:4173,http://localhost:3000').split(',').map((item) => item.trim()).filter(Boolean);
  if (production && jwtSecret.length < 32) throw new Error('JWT_SECRET должен содержать не менее 32 символов в production');
  if (production && !process.env.DATABASE_URL && !overrides.databaseUrl) throw new Error('DATABASE_URL обязателен в production: in-memory store нельзя публиковать');
  return { production, jwtSecret, allowedOrigins, allowDevTokens: overrides.allowDevTokens ?? !production };
}

function parseOrReply(schema, input, reply) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Проверьте введённые данные', fields: result.error.flatten() });
  return null;
}

export function buildApp(options = {}) {
  const config = configFrom(options);
  const store = options.store ?? createMemoryStore();
  const app = Fastify({ logger: options.logger ?? false, requestIdHeader: 'x-request-id', genReqId: () => randomUUID() });

  app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } });
  app.register(cors, { origin: (origin, callback) => callback(null, !origin || config.allowedOrigins.includes(origin)), credentials: true, methods: ['GET', 'POST', 'PATCH'] });
  app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute', keyGenerator: (request) => request.ip });
  app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: '15m' }, verify: { algorithms: ['HS256'] } });

  app.decorate('authenticate', async (request) => request.jwtVerify());
  app.decorate('allowRoles', (allowed) => async (request, reply) => {
    await request.jwtVerify();
    const userRoles = Array.isArray(request.user.roles) ? request.user.roles : [];
    if (!allowed.some((role) => userRoles.includes(role))) reply.code(403).send({ error: 'FORBIDDEN', message: 'Недостаточно прав для этого действия' });
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    reply.header('cache-control', 'no-store');
    return payload;
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Проверьте введённые данные', fields: error.flatten() });
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID' || error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Требуется действующая сессия' });
    request.log.error(error);
    return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервиса', requestId: request.id });
  });

  const audit = (request, action, entityType, entityId, before, after) => {
    store.audit({ actorId: request.user?.sub ?? 'anonymous', roles: request.user?.roles ?? [], action, entityType, entityId, before, after, requestId: request.id, ip: request.ip });
  };

  app.get('/health', async () => ({ ok: true, mode: config.production ? 'production' : 'development', time: now() }));

  // Local-only bootstrap. A production Studio must delegate identity to an OIDC provider.
  app.post('/v1/dev/token', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!config.allowDevTokens) return reply.code(404).send({ error: 'NOT_FOUND' });
    const body = parseOrReply(z.object({ subject: z.string().min(1).max(80), roles: z.array(z.enum(roles)).min(1).max(roles.length) }), request.body, reply);
    if (!body) return;
    return { accessToken: app.jwt.sign({ sub: body.subject, roles: body.roles }), expiresIn: 900 };
  });

  app.get('/v1/admin/overview', { preHandler: app.allowRoles(['superadmin', 'content_editor', 'moderator', 'analyst']) }, async () => store.overview());
  app.get('/v1/admin/content', { preHandler: app.allowRoles(['superadmin', 'content_editor', 'analyst']) }, async () => ({ items: store.listContent() }));
  app.post('/v1/admin/content', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const body = parseOrReply(contentInput, request.body, reply);
    if (!body) return;
    const item = store.createContent(body);
    audit(request, 'content.create', 'content', item.id, null, item);
    return reply.code(201).send({ item });
  });
  app.patch('/v1/admin/content/:id', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const params = parseOrReply(z.object({ id: z.string().min(1).max(80) }), request.params, reply);
    const body = parseOrReply(contentPatch, request.body, reply);
    if (!params || !body) return;
    const before = store.getContent(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    const item = store.updateContent(params.id, body);
    audit(request, 'content.update', 'content', item.id, before, item);
    return { item };
  });

  app.get('/v1/admin/home/slots', { preHandler: app.allowRoles(['superadmin', 'content_editor', 'analyst']) }, async () => ({ items: store.listHomeSlots() }));
  app.patch('/v1/admin/home/slots', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const body = parseOrReply(homeSlotsInput, request.body, reply);
    if (!body) return;
    const missing = body.contentIds.filter((id) => !store.getContent(id));
    if (missing.length) return reply.code(400).send({ error: 'INVALID_CONTENT', message: 'Одна или несколько карточек не найдены', ids: missing });
    const previous = store.listHomeSlots().map((item) => item.id);
    const items = store.replaceHomeSlots(body.contentIds);
    audit(request, 'home.reorder', 'home_slot', 'home', previous, items.map((item) => item.id));
    return { items };
  });

  app.get('/v1/admin/comments', { preHandler: app.allowRoles(['superadmin', 'moderator', 'analyst']) }, async (request, reply) => {
    const query = parseOrReply(z.object({ status: z.enum(commentStatuses).optional() }), request.query, reply);
    if (!query) return;
    return { items: store.listComments(query.status) };
  });
  app.patch('/v1/admin/comments/:id', { preHandler: app.allowRoles(['superadmin', 'moderator']) }, async (request, reply) => {
    const params = parseOrReply(z.object({ id: z.string().min(1).max(80) }), request.params, reply);
    const body = parseOrReply(commentActionInput, request.body, reply);
    if (!params || !body) return;
    const before = store.listComments().find((item) => item.id === params.id);
    const item = store.updateComment(params.id, body.status, body.note);
    if (!item) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Комментарий не найден' });
    audit(request, 'comment.moderate', 'comment', item.id, before, item);
    return { item };
  });

  app.post('/v1/events/playback', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = parseOrReply(playbackInput, request.body, reply);
    if (!body) return;
    if (!store.getContent(body.contentId)) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    store.addPlayback({ ...body, viewerId: request.user?.sub ?? null });
    return reply.code(202).send({ accepted: true });
  });

  return app;
}
