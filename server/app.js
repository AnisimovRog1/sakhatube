import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { z, ZodError } from 'zod';
import { createMediaStore } from './media-store.js';
import { createPostgresStore } from './postgres-store.js';

const roles = ['superadmin', 'content_editor', 'legal_reviewer', 'moderator', 'support', 'analyst'];
const contentKinds = ['series', 'episode', 'trailer', 'clip'];
const accessKinds = ['free', 'subscription', 'purchase'];
const ageRatings = ['0+', '6+', '12+', '16+', '18+'];
const rightsBases = ['original', 'contract', 'license', 'demo'];
const commentStatuses = ['pending', 'approved', 'hidden', 'deleted'];
const commentReportReasons = ['spam', 'abuse', 'hate', 'sexual', 'copyright', 'other'];
const publicRequestStatuses = ['received', 'awaiting_verification', 'in_progress', 'completed', 'rejected'];
const playbackEvents = ['intent', 'first_frame', 'pause', 'buffer_start', 'buffer_end', 'error', 'complete'];
const bannerMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const sourceVideoTypes = new Map([
  ['video/mp4', new Set(['mp4', 'm4v'])],
  ['video/quicktime', new Set(['mov'])],
  ['video/webm', new Set(['webm'])]
]);
const maxSourceVideoBytes = 50 * 1024 * 1024 * 1024;
const multipartPartSize = 16 * 1024 * 1024;
const multipartPartPageSize = 100;
const mediaJobMaxAttempts = 3;
const mediaJobLeaseMs = 15 * 60 * 1000;
const scrypt = promisify(scryptCallback);
const viewerAccessTokenTtlSeconds = 15 * 60;
const viewerRefreshTokenTtlMsDefault = 14 * 24 * 60 * 60 * 1000;
const emailVerificationTtlMsDefault = 24 * 60 * 60 * 1000;
const billingContractVersion = '2026-07-16';
const passwordScrypt = { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
// This hash is used only when a login email is absent.  Performing the same
// scrypt operation for both paths keeps the login endpoint from becoming an
// account-enumeration timing oracle.
const passwordDummyHash = 'scrypt$16384$8$1$c2FraGF0dWJlLWxvZ2luLWR1bW15LXNhbHQ$y2VCxWcPcvWNPgcA-ds8RhUGvt4qMTLWN9ietO4IciGLP9_-HI0-vytUfqc7xZuyz5OJJO7mOUtPGOLoV43y0A';

const now = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicFiles = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/styles.css', 'styles.css'],
  ['/app.js', 'app.js'],
  ['/admin.html', 'admin.html'],
  ['/admin.css', 'admin.css'],
  ['/admin.js', 'admin.js'],
  ['/legal.css', 'legal/legal.css'],
  ['/legal.js', 'legal/legal.js']
]);

const demoCompliance = {
  ageRating: '16+',
  rightsBasis: 'demo',
  rightsHolder: 'SakhaTube demo catalog',
  licenseReference: 'DEMO-ONLY — replace before commercial release',
  territories: ['global'],
  startsAt: '2026-07-01T00:00:00.000Z',
  endsAt: null,
  audioLanguages: ['ru'],
  subtitleLanguages: [],
  verifiedAt: '2026-07-14T09:00:00.000Z',
  verifiedBy: 'local-demo-reviewer',
  verificationReference: 'DEMO-REVIEW-ONLY'
};

export const defaultSeed = {
  content: [
    { id: 'midnight', title: 'После полуночи', kind: 'series', genre: 'Драма', synopsis: 'История, в которой одна ночь меняет всё.', status: 'published', access: 'subscription', episodes: 8, views: 128430, likes: 18320, compliance: demoCompliance, createdAt: '2026-07-10T10:00:00.000Z', updatedAt: '2026-07-14T09:00:00.000Z' },
    { id: 'signal', title: 'Тихий сигнал', kind: 'series', genre: 'Мистика', synopsis: 'Каждый новый сигнал открывает ещё одну тайну.', status: 'published', access: 'free', episodes: 10, views: 96420, likes: 12180, compliance: demoCompliance, createdAt: '2026-07-09T10:00:00.000Z', updatedAt: '2026-07-14T09:00:00.000Z' },
    { id: 'floor', title: 'Пятый этаж', kind: 'series', genre: 'Триллер', synopsis: 'Черновик нового сериала.', status: 'draft', access: 'subscription', episodes: 6, views: 0, likes: 0, compliance: demoCompliance, createdAt: '2026-07-14T10:00:00.000Z', updatedAt: '2026-07-14T10:00:00.000Z' }
  ],
  homeSlots: ['midnight', 'signal'],
  banners: [
    { id: 'banner-midnight', contentId: 'midnight', eyebrow: 'ПРЕМЬЕРА', title: 'После полуночи', description: 'Первая серия уже доступна. Продолжение выходит по пятницам.', cta: 'Смотреть сериал', tone: 'poster-one', active: true, mediaId: null },
    { id: 'banner-signal', contentId: 'signal', eyebrow: 'НОВАЯ ИСТОРИЯ', title: 'Тихий сигнал', description: 'Десять серий, в которых каждая находка меняет картину.', cta: 'Открыть сериал', tone: 'poster-two', active: true, mediaId: null }
  ],
  comments: [
    { id: 'comment-1', contentId: 'midnight', authorId: 'viewer-1', authorName: 'Мария К.', text: 'Очень жду продолжение. Концовка серии не отпускает.', status: 'pending', createdAt: '2026-07-14T08:30:00.000Z', updatedAt: '2026-07-14T08:30:00.000Z' },
    { id: 'comment-2', contentId: 'signal', authorId: 'viewer-2', authorName: 'Илья Р.', text: 'Когда выйдет следующая серия?', status: 'pending', createdAt: '2026-07-14T08:10:00.000Z', updatedAt: '2026-07-14T08:10:00.000Z' }
  ],
  playback: [],
  audit: []
};

export function createMemoryStore(seed = defaultSeed) {
  const state = clone({
    ...seed,
    banners: seed.banners ?? [],
    media: seed.media ?? [],
    mediaJobs: seed.mediaJobs ?? [],
    publicRequests: seed.publicRequests ?? [],
    viewerAccounts: seed.viewerAccounts ?? [],
    viewerSessions: seed.viewerSessions ?? [],
    commentReports: seed.commentReports ?? [],
    content: seed.content.map((item) => ({
      scheduledAt: null,
      publishedAt: null,
      unpublishedReason: null,
      ...item
    }))
  });

  function findContent(id) {
    return state.content.find((item) => item.id === id);
  }

  function findMedia(id) {
    return state.media.find((item) => item.id === id);
  }

  function findBanner(id) { return state.banners.find((item) => item.id === id); }

  function findMediaJob(id) { return state.mediaJobs.find((item) => item.id === id); }

  function findPublicRequest(id) {
    return state.publicRequests.find((item) => item.id === id);
  }

  function findViewerAccountById(id) {
    return state.viewerAccounts.find((item) => item.id === id);
  }

  function findViewerAccountByEmail(email) {
    return state.viewerAccounts.find((item) => item.email === email);
  }

  function findViewerAccountByUsername(username) {
    return state.viewerAccounts.find((item) => item.username === username);
  }

  function findViewerSessionByTokenHash(tokenHash) {
    return state.viewerSessions.find((item) => item.refreshTokenHash === tokenHash);
  }

  return {
    listContent() { return state.content.map(clone); },
    getContent(id) { const item = findContent(id); return item && clone(item); },
    createContent(data) {
      const record = {
        id: randomUUID(),
        views: 0,
        likes: 0,
        status: 'draft',
        scheduledAt: null,
        publishedAt: null,
        unpublishedReason: null,
        createdAt: now(),
        updatedAt: now(),
        ...data
      };
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
    listPublishedContent() { return state.content.filter((item) => item.status === 'published').map(clone); },
    listPublishedHomeSlots() { return state.homeSlots.map((id) => findContent(id)).filter((item) => item?.status === 'published').map(clone); },
    publishDueContent(at = now()) {
      const dueAt = new Date(at).getTime();
      const published = [];
      for (const item of state.content) {
        if (item.status !== 'scheduled' || !item.scheduledAt || new Date(item.scheduledAt).getTime() > dueAt) continue;
        Object.assign(item, { status: 'published', scheduledAt: null, publishedAt: at, unpublishedReason: null, updatedAt: at });
        published.push(clone(item));
      }
      return published;
    },
    replaceHomeSlots(ids) { state.homeSlots = [...ids]; return this.listHomeSlots(); },
    listBanners() { return state.banners.map(clone); },
    listPublishedBanners() { return state.banners.filter((item) => item.active && findContent(item.contentId)?.status === 'published').map(clone); },
    getBanner(id) { const item = findBanner(id); return item && clone(item); },
    createBanner(data) { const item = { id: randomUUID(), createdAt: now(), updatedAt: now(), ...data }; state.banners.push(item); return clone(item); },
    updateBanner(id, patch) { const item = findBanner(id); if (!item) return null; Object.assign(item, patch, { updatedAt: now() }); return clone(item); },
    deleteBanner(id) { const index = state.banners.findIndex((item) => item.id === id); if (index < 0) return null; return clone(state.banners.splice(index, 1)[0]); },
    replaceBanners(items) { state.banners = items.map((item) => ({ ...item, updatedAt: now() })); return this.listBanners(); },
    listComments(status) { return state.comments.filter((item) => !status || item.status === status).map(clone); },
    getComment(id) { const item = state.comments.find((comment) => comment.id === id); return item && clone(item); },
    listPublicComments(contentId, { limit = 50 } = {}) {
      return state.comments
        .filter((item) => item.contentId === contentId && item.status === 'approved')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(clone);
    },
    createComment(data) {
      const record = { id: randomUUID(), status: 'pending', moderationNote: null, createdAt: now(), updatedAt: now(), ...data };
      state.comments.unshift(record);
      return clone(record);
    },
    createCommentReport(data) {
      if (state.commentReports.some((item) => item.commentId === data.commentId && item.reporterId === data.reporterId)) {
        const error = new Error('COMMENT_ALREADY_REPORTED');
        error.code = 'COMMENT_ALREADY_REPORTED';
        throw error;
      }
      const record = { id: randomUUID(), status: 'open', createdAt: now(), ...data };
      state.commentReports.unshift(record);
      return clone(record);
    },
    listCommentReports({ status = 'open' } = {}) { return state.commentReports.filter((item) => !status || item.status === status).map(clone); },
    resolveCommentReports(commentId) {
      const resolvedAt = now();
      let count = 0;
      for (const report of state.commentReports) {
        if (report.commentId !== commentId || report.status !== 'open') continue;
        Object.assign(report, { status: 'resolved', resolvedAt });
        count += 1;
      }
      return count;
    },
    updateComment(id, status, moderationNote) {
      const comment = state.comments.find((item) => item.id === id);
      if (!comment) return null;
      Object.assign(comment, { status, moderationNote, updatedAt: now() });
      return clone(comment);
    },
    addPlayback(event) { state.playback.push({ id: randomUUID(), receivedAt: now(), ...event }); },
    createPublicRequest(data) {
      const record = {
        id: randomUUID(),
        status: 'received',
        verificationTokenHash: null,
        verificationExpiresAt: null,
        verifiedAt: null,
        resolutionNote: null,
        resolvedAt: null,
        createdAt: now(),
        updatedAt: now(),
        ...data
      };
      state.publicRequests.unshift(record);
      return clone(record);
    },
    listPublicRequests({ type, status } = {}) {
      return state.publicRequests
        .filter((item) => (!type || item.type === type) && (!status || item.status === status))
        .map(clone);
    },
    getPublicRequest(id) { const item = findPublicRequest(id); return item && clone(item); },
    updatePublicRequest(id, patch) {
      const item = findPublicRequest(id);
      if (!item) return null;
      Object.assign(item, patch, { updatedAt: now() });
      return clone(item);
    },
    createViewerAccount(data) {
      if (findViewerAccountByEmail(data.email)) {
        const error = new Error('VIEWER_EMAIL_EXISTS');
        error.code = 'VIEWER_EMAIL_EXISTS';
        throw error;
      }
      if (findViewerAccountByUsername(data.username)) {
        const error = new Error('VIEWER_USERNAME_EXISTS');
        error.code = 'VIEWER_USERNAME_EXISTS';
        throw error;
      }
      const record = {
        id: randomUUID(),
        status: 'pending_verification',
        verificationTokenHash: null,
        verificationExpiresAt: null,
        emailVerifiedAt: null,
        createdAt: now(),
        updatedAt: now(),
        ...data
      };
      state.viewerAccounts.unshift(record);
      return clone(record);
    },
    getViewerAccount(id) { const item = findViewerAccountById(id); return item && clone(item); },
    getViewerAccountByEmail(email) { const item = findViewerAccountByEmail(email); return item && clone(item); },
    getViewerAccountByUsername(username) { const item = findViewerAccountByUsername(username); return item && clone(item); },
    updateViewerAccount(id, patch) {
      const item = findViewerAccountById(id);
      if (!item) return null;
      Object.assign(item, patch, { updatedAt: now() });
      return clone(item);
    },
    createViewerSession(data) {
      const record = { id: randomUUID(), revokedAt: null, revocationReason: null, rotatedAt: null, createdAt: now(), lastUsedAt: now(), ...data };
      state.viewerSessions.unshift(record);
      return clone(record);
    },
    getViewerSession(id) { const item = state.viewerSessions.find((session) => session.id === id); return item && clone(item); },
    consumeViewerSession(tokenHash, replacement) {
      const current = findViewerSessionByTokenHash(tokenHash);
      if (!current) return { status: 'invalid' };
      if (current.revokedAt || new Date(current.expiresAt).getTime() <= Date.now()) return { status: 'reused', accountId: current.accountId };
      Object.assign(current, { revokedAt: now(), revocationReason: 'rotated', rotatedAt: now(), lastUsedAt: now() });
      const next = { id: randomUUID(), revokedAt: null, revocationReason: null, rotatedAt: null, createdAt: now(), lastUsedAt: now(), ...replacement, accountId: current.accountId };
      state.viewerSessions.unshift(next);
      return { status: 'rotated', previous: clone(current), session: clone(next) };
    },
    revokeViewerSession(id, reason = 'logout') {
      const item = state.viewerSessions.find((session) => session.id === id);
      if (!item || item.revokedAt) return null;
      Object.assign(item, { revokedAt: now(), revocationReason: reason, lastUsedAt: now() });
      return clone(item);
    },
    revokeViewerSessionsForAccount(accountId, reason = 'logout_all') {
      let count = 0;
      for (const item of state.viewerSessions) {
        if (item.accountId === accountId && !item.revokedAt) {
          Object.assign(item, { revokedAt: now(), revocationReason: reason, lastUsedAt: now() });
          count += 1;
        }
      }
      return count;
    },
    createMedia(data) {
      const record = {
        id: data.id ?? randomUUID(),
        contentId: null,
        relation: 'asset',
        status: 'available',
        durationMs: null,
        uploadId: null,
        partSize: null,
        partCount: null,
        metadata: {},
        completedAt: null,
        queuedAt: null,
        abortedAt: null,
        createdAt: now(),
        updatedAt: now(),
        ...data
      };
      state.media.unshift(record);
      return clone(record);
    },
    listMediaForContent(contentId) {
      return state.media.filter((item) => item.contentId === contentId).map(clone);
    },
    listMedia({ limit = 100 } = {}) {
      return state.media.slice(0, Math.max(1, Math.min(200, limit))).map(clone);
    },
    getMedia(id) { const item = findMedia(id); return item && clone(item); },
    updateMedia(id, patch) {
      const item = findMedia(id);
      if (!item) return null;
      Object.assign(item, patch, { updatedAt: now() });
      return clone(item);
    },
    createMediaJob(data) {
      const existing = state.mediaJobs.find((item) => item.sourceAssetId === data.sourceAssetId);
      if (existing) return clone(existing);
      const record = {
        id: randomUUID(), status: 'queued', attempt: 0, maxAttempts: mediaJobMaxAttempts,
        availableAt: now(), leaseToken: null, leaseExpiresAt: null, startedAt: null,
        completedAt: null, lastErrorCode: null, createdAt: now(), updatedAt: now(), ...data
      };
      state.mediaJobs.unshift(record);
      return clone(record);
    },
    listMediaJobs({ sourceAssetIds } = {}) {
      return state.mediaJobs.filter((item) => !sourceAssetIds || sourceAssetIds.includes(item.sourceAssetId)).map(clone);
    },
    getMediaJob(id) { const item = findMediaJob(id); return item && clone(item); },
    claimMediaJob({ workerId, leaseToken, leaseMs = mediaJobLeaseMs, at = now() }) {
      const timestamp = new Date(at).getTime();
      for (const item of state.mediaJobs) {
        if (item.status === 'running' && new Date(item.leaseExpiresAt).getTime() <= timestamp && item.attempt >= item.maxAttempts) {
          Object.assign(item, { status: 'dead', leaseToken: null, leaseExpiresAt: null, completedAt: at, updatedAt: at });
        }
      }
      const job = state.mediaJobs.find((item) => (item.status === 'queued' || item.status === 'retry_wait' || (item.status === 'running' && new Date(item.leaseExpiresAt).getTime() <= timestamp)) && new Date(item.availableAt).getTime() <= timestamp && item.attempt < item.maxAttempts);
      if (!job) return null;
      Object.assign(job, { status: 'running', workerId, attempt: job.attempt + 1, leaseToken, leaseExpiresAt: new Date(timestamp + leaseMs).toISOString(), startedAt: job.startedAt ?? at, updatedAt: at });
      return clone(job);
    },
    settleMediaJob(id, { leaseToken, outcome, errorCode = null, retryAt = null, at = now() }) {
      const item = findMediaJob(id);
      if (!item) return { status: 'not_found' };
      if (item.status === 'succeeded' && outcome === 'succeeded') return { status: 'idempotent', job: clone(item) };
      if (item.status !== 'running' || item.leaseToken !== leaseToken || new Date(item.leaseExpiresAt).getTime() <= new Date(at).getTime()) return { status: 'lease_lost' };
      const terminal = outcome === 'succeeded' || outcome === 'permanent_failure' || (outcome === 'retryable_failure' && item.attempt >= item.maxAttempts);
      const status = outcome === 'succeeded' ? 'succeeded' : terminal ? 'dead' : 'retry_wait';
      Object.assign(item, { status, leaseToken: null, leaseExpiresAt: null, completedAt: terminal ? at : null, availableAt: retryAt ?? at, lastErrorCode: errorCode, updatedAt: at });
      return { status: 'updated', job: clone(item) };
    },
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

const complianceInput = z.object({
  ageRating: z.enum(ageRatings),
  rightsBasis: z.enum(rightsBases),
  rightsHolder: z.string().trim().min(2).max(160),
  licenseReference: z.string().trim().min(3).max(240),
  territories: z.array(z.string().trim().min(2).max(16)).min(1).max(250).refine((value) => new Set(value.map((item) => item.toLowerCase())).size === value.length, 'Территории не должны повторяться'),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  audioLanguages: z.array(z.string().trim().min(2).max(16)).min(1).max(20),
  subtitleLanguages: z.array(z.string().trim().min(2).max(16)).max(20).default([]),
  verifiedAt: z.string().datetime({ offset: true }).optional()
}).strict().superRefine((value, context) => {
  if (value.endsAt && new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'Дата окончания прав должна быть позже даты начала' });
  }
});

const rightsVerificationInput = z.object({
  reference: z.string().trim().min(3).max(240)
}).strict();

const contentInput = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(contentKinds),
  genre: z.string().trim().min(1).max(64),
  synopsis: z.string().trim().max(2000).default(''),
  access: z.enum(accessKinds).default('free'),
  episodes: z.number().int().min(1).max(999).default(1),
  compliance: complianceInput.optional()
}).strict();

const contentPatch = contentInput.partial().strict();
const homeSlotsInput = z.object({ contentIds: z.array(z.string().uuid().or(z.string().min(1).max(80))).min(0).max(30).refine((ids) => new Set(ids).size === ids.length, 'Повторять карточки в витрине нельзя') });
const bannerTone = z.enum(['poster-one', 'poster-two', 'poster-three', 'poster-four', 'poster-five']);
const bannerInput = z.object({
  contentId: z.string().min(1).max(80),
  eyebrow: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(360).default(''),
  cta: z.string().trim().min(1).max(60),
  tone: bannerTone.default('poster-one'),
  active: z.boolean().default(false),
  mediaId: z.string().uuid().nullable().optional()
}).strict();
const bannerPatch = bannerInput.partial().strict();
const bannerOrderInput = z.object({ ids: z.array(z.string().uuid().or(z.string().min(1).max(80))).max(20).refine((ids) => new Set(ids).size === ids.length, 'Повторять баннеры нельзя') }).strict();
const bannerParams = z.object({ id: z.string().uuid().or(z.string().min(1).max(80)) });
const commentActionInput = z.object({ status: z.enum(['approved', 'hidden', 'deleted']), note: z.string().trim().max(500).optional() });
const commentCreateInput = z.object({
  text: z.string().trim().min(1).max(1_000).refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value), 'Комментарий содержит недопустимые символы')
}).strict();
const commentReportInput = z.object({ reason: z.enum(commentReportReasons), note: z.string().trim().max(500).optional() }).strict();
const publicCommentsQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();
const commentReportQuery = z.object({ status: z.enum(['open', 'resolved']).optional() }).strict();
const contentParams = z.object({ id: z.string().min(1).max(80) });
const submitReviewInput = z.object({ note: z.string().trim().max(500).optional() }).default({});
const publishInput = z.object({ scheduledAt: z.string().datetime({ offset: true }).optional() }).default({});
const unpublishInput = z.object({ reason: z.string().trim().min(3).max(500) });
const publicRequestInput = z.object({
  email: z.string().trim().email().max(254),
  accountEmail: z.string().trim().email().max(254).optional(),
  message: z.string().trim().max(1_000).optional(),
  confirmation: z.literal(true)
}).strict();
const publicRequestParams = z.object({ id: z.string().uuid() });
const publicRequestQuery = z.object({
  type: z.enum(['deletion', 'support']).optional(),
  status: z.enum(publicRequestStatuses).optional()
}).strict();
const publicRequestAction = z.object({
  status: z.enum(['in_progress', 'completed', 'rejected']),
  note: z.string().trim().max(1_000).optional()
}).strict();
const deletionVerificationInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Некорректный код подтверждения') }).strict();
const viewerRegistrationInput = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12, 'Пароль должен содержать минимум 12 символов').max(128),
  // Логин — отдельное, постоянное имя для входа. E-mail никогда не показываем
  // другим зрителям и он остаётся способом восстановления доступа.
  username: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/, 'Логин: 3–32 символа, латиница, цифры, точка, дефис или подчёркивание').optional(),
  displayName: z.string().trim().min(2).max(60).optional()
}).strict();
const viewerLoginInput = z.object({
  login: z.string().trim().min(3).max(254).optional(),
  // Временная обратная совместимость для ранних клиентов. Новые клиенты
  // отправляют login (имя пользователя или e-mail).
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(1).max(128)
}).strict().refine((value) => Boolean(value.login || value.email), { message: 'Укажи логин или e-mail', path: ['login'] });
const viewerEmailVerificationInput = z.object({
  accountId: z.string().uuid(),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Некорректный код подтверждения')
}).strict();
const viewerRefreshInput = z.object({
  refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Некорректный токен обновления')
}).strict();
const playbackInput = z.object({
  contentId: z.string().min(1).max(80),
  sessionId: z.string().min(16).max(128),
  event: z.enum(playbackEvents),
  positionMs: z.number().int().min(0).max(86_400_000).optional(),
  errorCode: z.string().trim().max(80).optional()
});
const playbackSessionInput = z.object({
  contentId: z.string().min(1).max(80)
}).strict();
const uploadInitInput = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().toLowerCase().max(100),
  size: z.number().int().min(1).max(maxSourceVideoBytes),
  contentId: z.string().min(1).max(80).optional()
}).strict();
const uploadPartInput = z.object({
  number: z.number().int().min(1).max(10_000),
  etag: z.string().trim().min(1).max(512).refine(
    (value) => /^(?:[A-Za-z0-9+/=._:-]+|"[A-Za-z0-9+/=._:-]+")$/.test(value),
    'Некорректный ETag части'
  )
}).strict();
const uploadCompleteInput = z.object({
  parts: z.array(uploadPartInput).min(1).max(10_000)
}).strict();
const mediaParams = z.object({ id: z.string().uuid() });
const mediaListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional()
}).strict();
const uploadPartsQuery = z.object({
  from: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(multipartPartPageSize).optional()
}).strict();
const workerClaimInput = z.object({ workerId: z.string().trim().min(3).max(80) }).strict();
const workerJobParams = z.object({ id: z.string().uuid() });
const workerJobSettleInput = z.object({
  leaseToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  outcome: z.enum(['succeeded', 'retryable_failure', 'permanent_failure']),
  errorCode: z.string().trim().regex(/^[A-Z0-9_]{3,80}$/).optional(),
  retryAfterSeconds: z.number().int().min(15).max(86_400).optional(),
  renditionAssetId: z.string().uuid().optional()
}).strict().superRefine((value, context) => {
  if (value.outcome === 'succeeded' && !value.renditionAssetId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['renditionAssetId'], message: 'Нужен готовый HLS-asset' });
  if (value.outcome !== 'succeeded' && value.renditionAssetId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['renditionAssetId'], message: 'HLS-asset допускается только при успехе' });
});

function sourceVideoExtension(fileName, contentType) {
  if (!fileName || /[\\/\u0000]/.test(fileName) || /[\r\n]/.test(fileName)) return null;
  const extension = fileName.split('.').pop()?.toLowerCase();
  const allowedExtensions = sourceVideoTypes.get(contentType);
  if (!extension || !allowedExtensions?.has(extension)) return null;
  return extension;
}

function configFrom(overrides = {}) {
  const railwayHost = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  const production = (overrides.nodeEnv ?? process.env.NODE_ENV) === 'production' || railwayHost;
  const jwtSecret = overrides.jwtSecret ?? process.env.JWT_SECRET ?? 'local-development-secret-change-before-production';
  const allowedOrigins = overrides.allowedOrigins ?? (process.env.ALLOWED_ORIGINS || 'http://localhost:4173,http://localhost:3000').split(',').map((item) => item.trim()).filter(Boolean);
  const allowDemoStore = overrides.allowDemoStore ?? process.env.ALLOW_DEMO_STORE === 'true';
  // A visual paywall is not a payment implementation. No environment variable
  // can grant a commercial entitlement: this server has no StoreKit / Google
  // Play receipt validator or verified store-notification handler yet.
  const paymentsRequested = overrides.paymentsEnabled ?? process.env.PAYMENTS_ENABLED === 'true';
  const billing = {
    contractVersion: billingContractVersion,
    requested: Boolean(paymentsRequested),
    serverValidation: 'not_implemented',
    entitlementGrants: 'blocked',
    status: paymentsRequested ? 'blocked_not_implemented' : 'disabled',
    canGrantEntitlements: false
  };
  const paymentsEnabled = !production && Boolean(paymentsRequested);
  const databaseUrl = overrides.databaseUrl ?? process.env.DATABASE_URL;
  const deletionVerificationSecret = overrides.deletionVerificationSecret ?? process.env.DELETION_VERIFICATION_SECRET ?? jwtSecret;
  const deletionVerificationTtlMs = overrides.deletionVerificationTtlMs ?? Number(process.env.DELETION_VERIFICATION_TTL_MS || 24 * 60 * 60 * 1000);
  const emailVerificationSecret = overrides.emailVerificationSecret ?? process.env.EMAIL_VERIFICATION_SECRET ?? jwtSecret;
  const viewerRefreshTokenSecret = overrides.viewerRefreshTokenSecret ?? process.env.VIEWER_REFRESH_TOKEN_SECRET ?? jwtSecret;
  const emailVerificationTtlMs = overrides.emailVerificationTtlMs ?? Number(process.env.EMAIL_VERIFICATION_TTL_MS || emailVerificationTtlMsDefault);
  const viewerRefreshTokenTtlMs = overrides.viewerRefreshTokenTtlMs ?? Number(process.env.VIEWER_REFRESH_TOKEN_TTL_MS || viewerRefreshTokenTtlMsDefault);
  const publicBaseUrl = (overrides.publicBaseUrl ?? process.env.PUBLIC_APP_URL ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')).replace(/\/$/, '');
  const mailerWebhookUrl = overrides.mailerWebhookUrl ?? process.env.MAILER_WEBHOOK_URL ?? '';
  const mailerWebhookBearerToken = overrides.mailerWebhookBearerToken ?? process.env.MAILER_WEBHOOK_BEARER_TOKEN ?? '';
  const mailer = overrides.mailer ?? null;
  const mediaWorkerToken = overrides.mediaWorkerToken ?? process.env.MEDIA_WORKER_TOKEN ?? '';
  const mediaWorkerEnabled = overrides.mediaWorkerEnabled ?? process.env.MEDIA_WORKER_ENABLED === 'true';
  const media = overrides.media ?? {
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'auto'
  };
  if (production && jwtSecret.length < 32) throw new Error('JWT_SECRET должен содержать не менее 32 символов в production');
  if (production && !databaseUrl && !allowDemoStore) throw new Error('DATABASE_URL обязателен в production: in-memory store нельзя публиковать');
  if (!Number.isInteger(deletionVerificationTtlMs) || deletionVerificationTtlMs < 60_000 || deletionVerificationTtlMs > 7 * 24 * 60 * 60 * 1000) throw new Error('DELETION_VERIFICATION_TTL_MS должен быть от 1 минуты до 7 дней');
  if (!Number.isInteger(emailVerificationTtlMs) || emailVerificationTtlMs < 60_000 || emailVerificationTtlMs > 7 * 24 * 60 * 60 * 1000) throw new Error('EMAIL_VERIFICATION_TTL_MS должен быть от 1 минуты до 7 дней');
  if (!Number.isInteger(viewerRefreshTokenTtlMs) || viewerRefreshTokenTtlMs < 60 * 60 * 1000 || viewerRefreshTokenTtlMs > 90 * 24 * 60 * 60 * 1000) throw new Error('VIEWER_REFRESH_TOKEN_TTL_MS должен быть от 1 часа до 90 дней');
  if (production && deletionVerificationSecret.length < 32) throw new Error('DELETION_VERIFICATION_SECRET должен содержать не менее 32 символов в production');
  if (production && emailVerificationSecret.length < 32) throw new Error('EMAIL_VERIFICATION_SECRET должен содержать не менее 32 символов в production');
  if (production && viewerRefreshTokenSecret.length < 32) throw new Error('VIEWER_REFRESH_TOKEN_SECRET должен содержать не менее 32 символов в production');
  if (production && mediaWorkerEnabled && mediaWorkerToken.length < 32) throw new Error('MEDIA_WORKER_TOKEN должен содержать не менее 32 символов в production');
  return { production, jwtSecret, allowedOrigins, allowDevTokens: overrides.allowDevTokens ?? !production, allowDemoStore, paymentsEnabled, billing, databaseUrl, media, deletionVerificationSecret, deletionVerificationTtlMs, emailVerificationSecret, emailVerificationTtlMs, viewerRefreshTokenSecret, viewerRefreshTokenTtlMs, publicBaseUrl, mailerWebhookUrl, mailerWebhookBearerToken, mailer, mediaWorkerToken, mediaWorkerEnabled };
}

function deletionTokenHash(token, secret) {
  return createHash('sha256').update(`${secret}:${token}`).digest('hex');
}

function emailVerificationTokenHash(token, secret) {
  return createHash('sha256').update(`email-verification:${secret}:${token}`).digest('hex');
}

function viewerRefreshTokenHash(token, secret) {
  return createHash('sha256').update(`viewer-refresh:${secret}:${token}`).digest('hex');
}

function deviceNameFrom(request) {
  const raw = request.headers['x-device-name'];
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value && value.length <= 80 ? value : null;
}

function safeEqualText(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function encodePasswordHash(salt, derived) {
  return `scrypt$${passwordScrypt.N}$${passwordScrypt.r}$${passwordScrypt.p}$${salt}$${derived.toString('base64url')}`;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const derived = await scrypt(password, salt, 64, passwordScrypt);
  return encodePasswordHash(salt, derived);
}

async function verifyPassword(password, encoded) {
  const parts = typeof encoded === 'string' ? encoded.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [,, rString, pString, salt, expectedString] = parts;
  const N = Number(parts[1]);
  const r = Number(rString);
  const p = Number(pString);
  // Stored parameters are deliberately fixed. Never permit an attacker to
  // supply a very expensive hash through a compromised database record.
  if (N !== passwordScrypt.N || r !== passwordScrypt.r || p !== passwordScrypt.p || !salt || !expectedString) return false;
  let expected;
  try {
    expected = Buffer.from(expectedString, 'base64url');
  } catch {
    return false;
  }
  if (expected.length !== 64) return false;
  const derived = await scrypt(password, salt, 64, passwordScrypt);
  return timingSafeEqual(derived, expected);
}

function viewerAccountPublic(account) {
  if (!account) return null;
  return {
    // UUID остаётся внутренним ключом: в токенах, сессиях и связях БД. Клиент
    // получает только неизменяемый публичный ID, который безопасно показывать.
    id: account.publicId,
    username: account.username,
    email: account.email,
    displayName: account.displayName,
    status: account.status,
    createdAt: account.createdAt
  };
}

function makePublicViewerId() {
  return `ST-${randomBytes(6).toString('hex').toUpperCase()}`;
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function fallbackUsername() {
  return `viewer-${randomBytes(5).toString('hex')}`;
}

function publicComment(comment) {
  if (!comment) return null;
  return {
    id: comment.id,
    contentId: comment.contentId,
    authorName: comment.authorName,
    text: comment.text,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

function viewerComment(comment) {
  if (!comment) return null;
  return { ...publicComment(comment), status: comment.status };
}

function publicRequestForStaff(item) {
  if (!item) return item;
  const { verificationTokenHash, ...safe } = item;
  return { ...safe, verificationStatus: item.type === 'deletion' ? (item.verifiedAt ? 'verified' : 'pending') : null };
}

async function sendDeletionVerification(config, item, token) {
  const verificationUrl = `${config.publicBaseUrl}/delete-account?request=${encodeURIComponent(item.id)}&token=${encodeURIComponent(token)}`;
  const message = {
    type: 'sakhatube.deletion_verification',
    to: item.email,
    subject: 'Подтверди удаление данных SakhaTube',
    text: `Подтверди запрос на удаление данных: ${verificationUrl}\nСсылка действует до ${item.verificationExpiresAt}. Если это не ты — просто проигнорируй письмо.`,
    requestId: item.id,
    verificationUrl,
    expiresAt: item.verificationExpiresAt
  };
  if (config.mailer) return config.mailer(message);
  if (!config.mailerWebhookUrl) throw new Error('MAILER_NOT_CONFIGURED');
  const response = await fetch(config.mailerWebhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.mailerWebhookBearerToken ? { authorization: `Bearer ${config.mailerWebhookBearerToken}` } : {})
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`MAILER_REJECTED_${response.status}`);
}

async function sendEmailVerification(config, account, token) {
  const verificationUrl = `${config.publicBaseUrl}/verify-email?account=${encodeURIComponent(account.id)}&token=${encodeURIComponent(token)}`;
  const message = {
    type: 'sakhatube.email_verification',
    to: account.email,
    subject: 'Подтверди e-mail SakhaTube',
    text: `Подтверди e-mail для SakhaTube: ${verificationUrl}\nСсылка действует до ${account.verificationExpiresAt}. Если это не ты — просто проигнорируй письмо.`,
    accountId: account.id,
    verificationUrl,
    expiresAt: account.verificationExpiresAt
  };
  if (config.mailer) return config.mailer(message);
  if (!config.mailerWebhookUrl) throw new Error('MAILER_NOT_CONFIGURED');
  const response = await fetch(config.mailerWebhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.mailerWebhookBearerToken ? { authorization: `Bearer ${config.mailerWebhookBearerToken}` } : {})
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`MAILER_REJECTED_${response.status}`);
}

function parseOrReply(schema, input, reply) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Проверьте введённые данные', fields: result.error.flatten() });
  return null;
}

function contentPublicationBlocks(item, at = now(), { allowDemoRights = false, allowPaidAccess = true, requireLegalVerification = true } = {}) {
  const compliance = item?.compliance;
  const blocks = [];
  if (!compliance) return ['Не заполнены права, возрастной рейтинг и языки контента'];
  if (!ageRatings.includes(compliance.ageRating)) blocks.push('Не указан допустимый возрастной рейтинг');
  if (!rightsBases.includes(compliance.rightsBasis)) blocks.push('Не указано основание прав на показ');
  if (compliance.rightsBasis === 'demo' && !allowDemoRights) blocks.push('Демо-материал нельзя публиковать в production');
  if (['subscription', 'purchase'].includes(item.access) && !allowPaidAccess) {
    blocks.push('Платный доступ отключён: сначала подключите StoreKit, Google Play Billing и серверную проверку покупок');
  }
  if (!compliance.rightsHolder?.trim()) blocks.push('Не указан правообладатель');
  if (!compliance.licenseReference?.trim()) blocks.push('Не указан договор, лицензия или иной документ-основание');
  if (!Array.isArray(compliance.territories) || !compliance.territories.length) blocks.push('Не указаны территории показа');
  if (!Array.isArray(compliance.audioLanguages) || !compliance.audioLanguages.length) blocks.push('Не указан язык аудио');
  const startsAt = new Date(compliance.startsAt).getTime();
  const endsAt = compliance.endsAt ? new Date(compliance.endsAt).getTime() : null;
  const targetAt = new Date(at).getTime();
  if (!Number.isFinite(startsAt) || startsAt > targetAt) blocks.push('Права ещё не действуют на дату публикации');
  if (endsAt !== null && (!Number.isFinite(endsAt) || endsAt <= targetAt)) blocks.push('Срок прав истёк');
  if (requireLegalVerification && (!compliance.verifiedAt || !compliance.verifiedBy || !compliance.verificationReference)) {
    blocks.push('Права не подтверждены юридическим проверяющим');
  }
  return blocks;
}

function isPubliclyAvailable(item, at = now(), options = {}) {
  return item?.status === 'published' && contentPublicationBlocks(item, at, options).length === 0;
}

// Rights records belong to the internal Studio only.  The public catalogue
// receives the information a viewer needs (rating and available languages),
// but never contract references or the name of a rights holder.
function publicContent(item) {
  if (!item) return null;
  const { compliance, ...content } = item;
  return {
    ...content,
    ageRating: compliance?.ageRating ?? null,
    audioLanguages: Array.isArray(compliance?.audioLanguages) ? compliance.audioLanguages : [],
    subtitleLanguages: Array.isArray(compliance?.subtitleLanguages) ? compliance.subtitleLanguages : []
  };
}

export function buildApp(options = {}) {
  const config = configFrom(options);
  const publicationGate = {
    allowDemoRights: !config.production,
    allowPaidAccess: !config.production || config.billing.canGrantEntitlements
  };
  let store = options.store ?? null;
  const mediaStore = options.mediaStore ?? createMediaStore(config.media);
  // Playback gateway URLs carry a short-lived signed token. Fastify's default
  // 100-character route parameter limit would reject a valid token before the
  // gateway can verify it.
  // Playback JWTs are opaque and longer than Fastify's small routing default.
  // Keep a finite cap, but allow a signed session to travel in the path.
  const app = Fastify({ logger: options.logger ?? false, requestIdHeader: 'x-request-id', genReqId: () => randomUUID(), routerOptions: { maxParamLength: 4096 } });

  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        // The local preview intentionally streams the temporary legal CC
        // assets from the deployed demo origin. Production premium streams
        // will move to an entitlement-controlled CDN allow-list.
        mediaSrc: ["'self'", 'https://sakhatube-production.up.railway.app'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']
      }
    },
    crossOriginResourcePolicy: { policy: 'same-site' }
  });
  app.register(cors, { origin: (origin, callback) => callback(null, !origin || config.allowedOrigins.includes(origin)), credentials: true, methods: ['GET', 'POST', 'PATCH'] });
  app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute', keyGenerator: (request) => request.ip });
  app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: '15m' }, verify: { algorithms: ['HS256'] } });
  app.register(multipart, { limits: { files: 1, fileSize: 15 * 1024 * 1024 } });

  app.decorate('authenticate', async (request) => request.jwtVerify());
  app.decorate('requireViewer', async (request, reply) => {
    await request.jwtVerify();
    if (request.user?.kind !== 'viewer' || !request.user?.sub || !request.user?.sid) {
      return reply.code(403).send({ error: 'VIEWER_SESSION_REQUIRED', message: 'Требуется сессия зрителя' });
    }
    const session = await store.getViewerSession(request.user.sid);
    if (!session || session.accountId !== request.user.sub || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      return reply.code(401).send({ error: 'SESSION_REVOKED', message: 'Сессия завершена. Войди снова.' });
    }
  });
  app.decorate('allowRoles', (allowed) => async (request, reply) => {
    await request.jwtVerify();
    if (request.user?.kind === 'viewer') return reply.code(403).send({ error: 'FORBIDDEN', message: 'Недостаточно прав для этого действия' });
    const userRoles = Array.isArray(request.user.roles) ? request.user.roles : [];
    if (!allowed.some((role) => userRoles.includes(role))) reply.code(403).send({ error: 'FORBIDDEN', message: 'Недостаточно прав для этого действия' });
  });
  app.decorate('requireMediaWorker', async (request, reply) => {
    if (!config.mediaWorkerToken) return reply.code(503).send({ error: 'WORKER_UNAVAILABLE', message: 'Обработчик видео ещё не настроен' });
    const supplied = request.headers['x-sakhatube-worker-token'];
    if (typeof supplied !== 'string') return reply.code(401).send({ error: 'WORKER_UNAUTHORIZED' });
    const expected = Buffer.from(config.mediaWorkerToken);
    const actual = Buffer.from(supplied);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return reply.code(401).send({ error: 'WORKER_UNAUTHORIZED' });
  });

  app.addHook('onReady', async () => {
    if (store) return;
    store = config.databaseUrl ? await createPostgresStore(config.databaseUrl, defaultSeed) : createMemoryStore();
  });
  app.addHook('onClose', async () => {
    if (store?.close) await store.close();
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    if ((request.url === '/health' || request.url.startsWith('/v1/')) && !reply.getHeader('cache-control')) reply.header('cache-control', 'no-store');
    return payload;
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Проверьте введённые данные', fields: error.flatten() });
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID' || error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Требуется действующая сессия' });
    request.log.error(error);
    return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервиса', requestId: request.id });
  });

  const audit = (request, action, entityType, entityId, before, after, actor = null) => Promise.resolve(store.audit({
    actorId: actor?.id ?? request.user?.sub ?? 'anonymous',
    roles: actor?.roles ?? request.user?.roles ?? [],
    action,
    entityType,
    entityId,
    before,
    after,
    requestId: request.id,
    ip: request.ip
  })).catch((error) => request.log.error(error));

  const promoteDueScheduledContent = async (request) => {
    const at = now();
    const scheduledItems = (await store.listContent()).filter((item) => item.status === 'scheduled' && item.scheduledAt && new Date(item.scheduledAt).getTime() <= new Date(at).getTime());
    for (const before of scheduledItems) {
      const blocks = contentPublicationBlocks(before, at, publicationGate);
      const item = blocks.length
        ? await store.updateContent(before.id, { status: 'unpublished', scheduledAt: null, unpublishedReason: `Автоматическая проверка заблокировала публикацию: ${blocks.join('; ')}` })
        : await store.updateContent(before.id, { status: 'published', scheduledAt: null, publishedAt: at, unpublishedReason: null });
      await audit(request, blocks.length ? 'content.schedule.blocked' : 'content.publish.scheduled', 'content', item.id, before, item, { id: 'system', roles: [] });
    }
  };

  const lifecycleConflict = (reply, item, message) => reply.code(409).send({
    error: 'INVALID_LIFECYCLE_STATE',
    message,
    status: item.status
  });

  const multipartStoreAvailable = () => mediaStore && [
    'createMultipartUpload',
    'presignUploadPart',
    'completeMultipartUpload',
    'abortMultipartUpload'
  ].every((method) => typeof mediaStore[method] === 'function');

  // A rendition is deliberately recognised only through this explicit worker
  // contract. Uploaded source assets, a generic video file, or a guessed S3
  // key can never become playable merely by changing a content record.
  const readyHlsRenditionFor = async (contentId) => {
    const assets = await store.listMediaForContent?.(contentId) ?? [];
    return assets.find((asset) => {
      const hls = asset.metadata?.playback?.hls;
      return asset.relation === 'rendition'
        && asset.status === 'ready'
        && asset.kind === 'hls'
        && asset.contentType === 'application/vnd.apple.mpegurl'
        && hls?.state === 'ready'
        && typeof hls.manifestKey === 'string'
        && typeof hls.prefix === 'string'
        && hls.manifestKey.startsWith(hls.prefix)
        && hls.manifestKey.endsWith('.m3u8')
        && hls.prefix.startsWith('renditions/');
    }) ?? null;
  };

  const safeHlsPath = (value) => typeof value === 'string'
    && value.length > 0
    && value.length <= 1_024
    && !value.startsWith('/')
    && !value.includes('\\')
    && value.split('/').every((part) => part && part !== '.' && part !== '..');

  const hlsManifestIsGatewaySafe = (body) => {
    const text = body.toString('utf8');
    if (!text.startsWith('#EXTM3U')) return false;
    // Absolute or root-relative media URIs would bypass this entitlement
    // gateway. The transcode worker must emit only relative HLS references.
    return !/(?:https?:\/\/|URI=["']\/|^\/)/mi.test(text);
  };

  const buildUploadPartPage = async (asset, from = 1, limit = multipartPartPageSize) => {
    const first = Math.min(from, asset.partCount + 1);
    const last = Math.min(first + limit - 1, asset.partCount);
    const numbers = [];
    for (let number = first; number <= last; number += 1) numbers.push(number);
    const parts = await Promise.all(numbers.map(async (number) => ({
      number,
      url: await mediaStore.presignUploadPart({
        storageKey: asset.storageKey,
        uploadId: asset.uploadId,
        partNumber: number
      })
    })));
    return {
      parts,
      nextPartNumber: last < asset.partCount ? last + 1 : null
    };
  };

  const catalogHome = async (request) => {
    await promoteDueScheduledContent(request);
    const items = (await store.listPublishedHomeSlots())
      .filter((item) => isPubliclyAvailable(item, now(), publicationGate))
      .map(publicContent);
    const banners = await Promise.all((await store.listPublishedBanners()).map(async (banner) => {
      const content = await store.getContent(banner.contentId);
      if (!isPubliclyAvailable(content, now(), publicationGate)) return null;
      const media = banner.mediaId ? await store.getMedia(banner.mediaId) : null;
      return {
        id: banner.id,
        contentId: banner.contentId,
        eyebrow: banner.eyebrow,
        title: banner.title,
        description: banner.description,
        cta: banner.cta,
        tone: banner.tone,
        media: media?.kind === 'banner' ? { id: media.id, url: `/v1/media/${media.id}`, alt: banner.title } : null
      };
    }));
    return {
      hero: items[0] ?? null,
      banners: banners.filter(Boolean),
      shelves: [{ id: 'featured', title: 'Популярное', items }],
      items
    };
  };

  app.get('/health', async () => ({ ok: true, mode: config.production ? 'production' : 'development', persistence: config.databaseUrl ? 'postgresql' : 'preview-memory', media: mediaStore ? 'railway-bucket' : 'preview-local', payments: config.paymentsEnabled ? 'development-only' : 'disabled', billing: { contractVersion: config.billing.contractVersion, status: config.billing.status, serverValidation: config.billing.serverValidation, entitlementGrants: config.billing.entitlementGrants }, time: now() }));

  // Local-only bootstrap. A production Studio must delegate identity to an OIDC provider.
  app.post('/v1/dev/token', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!config.allowDevTokens) return reply.code(404).send({ error: 'NOT_FOUND' });
    const body = parseOrReply(z.object({ subject: z.string().min(1).max(80), roles: z.array(z.enum(roles)).min(1).max(roles.length) }), request.body, reply);
    if (!body) return;
    return { accessToken: app.jwt.sign({ sub: body.subject, roles: body.roles }), expiresIn: 900 };
  });

  const viewerSession = async (account, request) => {
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await store.createViewerSession({
      accountId: account.id,
      refreshTokenHash: viewerRefreshTokenHash(refreshToken, config.viewerRefreshTokenSecret),
      expiresAt: new Date(Date.now() + config.viewerRefreshTokenTtlMs).toISOString(),
      deviceName: deviceNameFrom(request)
    });
    return {
      accessToken: app.jwt.sign({ sub: account.id, kind: 'viewer', sid: session.id }, { expiresIn: viewerAccessTokenTtlSeconds }),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: viewerAccessTokenTtlSeconds,
      refreshExpiresIn: Math.floor(config.viewerRefreshTokenTtlMs / 1000),
      viewer: viewerAccountPublic(account)
    };
  };

  app.post('/v1/auth/register', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const body = parseOrReply(viewerRegistrationInput, request.body, reply);
    if (!body) return;
    const email = body.email.toLowerCase();
    const existing = await store.getViewerAccountByEmail(email);
    // Always derive a password hash, including for an existing address, to make
    // this endpoint less useful as an account-enumeration timing oracle.
    const passwordHash = await hashPassword(body.password);
    const genericResponse = () => reply.code(202).send({
      status: 'verification_required',
      message: 'Если этот адрес можно использовать, мы отправили письмо для подтверждения.'
    });
    if (config.production && (!config.publicBaseUrl || (!config.mailer && !config.mailerWebhookUrl))) {
      return reply.code(503).send({ error: 'EMAIL_VERIFICATION_UNAVAILABLE', message: 'Подтверждение e-mail временно недоступно. Попробуй позже.' });
    }
    if (existing?.status === 'active' || existing?.status === 'disabled' || existing?.status === 'deleted') return genericResponse();

    const token = randomBytes(32).toString('base64url');
    const verificationExpiresAt = new Date(Date.now() + config.emailVerificationTtlMs).toISOString();
    let account;
    try {
      if (existing?.status === 'pending_verification') {
        // A resend is allowed only with the original password; the public
        // response remains identical whether the address exists or not.
        const passwordValid = await verifyPassword(body.password, existing.passwordHash);
        if (!passwordValid) return genericResponse();
        account = await store.updateViewerAccount(existing.id, {
          verificationTokenHash: emailVerificationTokenHash(token, config.emailVerificationSecret),
          verificationExpiresAt,
          emailVerifiedAt: null
        });
      } else {
        const username = body.username ? normalizeUsername(body.username) : fallbackUsername();
        account = await store.createViewerAccount({
          email,
          username,
          publicId: makePublicViewerId(),
          displayName: body.displayName?.trim() || email.split('@')[0],
          passwordHash,
          lastLoginAt: null,
          status: 'pending_verification',
          verificationTokenHash: emailVerificationTokenHash(token, config.emailVerificationSecret),
          verificationExpiresAt,
          emailVerifiedAt: null
        });
      }
      // Local preview intentionally has no mail provider. It exposes the
      // one-time code only behind the development-only flag; production always
      // sends through the configured mailer/webhook.
      if (config.production || config.mailer || config.mailerWebhookUrl) await sendEmailVerification(config, account, token);
      await audit(request, existing ? 'viewer.email_verification.resent' : 'viewer.register', 'viewer_account', account.id, null, { status: account.status, verificationExpiresAt }, { id: account.id, roles: ['viewer'] });
      const response = { status: 'verification_required', message: 'Если этот адрес можно использовать, мы отправили письмо для подтверждения.' };
      if (!config.production && config.allowDevTokens) response.developmentVerification = { accountId: account.id, token, verifyPath: '/v1/auth/verify-email', expiresAt: verificationExpiresAt };
      return reply.code(202).send(response);
    } catch (error) {
      if (error.code === 'VIEWER_EMAIL_EXISTS' || error.code === 'VIEWER_USERNAME_EXISTS' || error.code === '23505') {
        return genericResponse();
      }
      request.log.error({ err: error, email }, 'Viewer email verification delivery failed');
      return reply.code(503).send({ error: 'EMAIL_VERIFICATION_UNAVAILABLE', message: 'Не удалось отправить письмо подтверждения. Попробуй позже.' });
    }
  });

  app.post('/v1/auth/verify-email', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const body = parseOrReply(viewerEmailVerificationInput, request.body, reply);
    if (!body) return;
    const account = await store.getViewerAccount(body.accountId);
    const invalid = !account || account.status !== 'pending_verification' || !account.verificationTokenHash || !account.verificationExpiresAt
      || new Date(account.verificationExpiresAt).getTime() < Date.now()
      || !safeEqualText(account.verificationTokenHash, emailVerificationTokenHash(body.token, config.emailVerificationSecret));
    if (invalid) return reply.code(400).send({ error: 'INVALID_VERIFICATION', message: 'Ссылка недействительна или уже использована.' });
    const verifiedAt = now();
    const verified = await store.updateViewerAccount(account.id, {
      status: 'active',
      emailVerifiedAt: verifiedAt,
      verificationTokenHash: null,
      verificationExpiresAt: null
    });
    await audit(request, 'viewer.email_verification.complete', 'viewer_account', account.id, { status: account.status }, { status: verified.status, emailVerifiedAt: verifiedAt }, { id: account.id, roles: ['viewer'] });
    return reply.code(200).send(await viewerSession(verified, request));
  });

  app.post('/v1/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const body = parseOrReply(viewerLoginInput, request.body, reply);
    if (!body) return;
    const login = (body.login ?? body.email).trim();
    const account = login.includes('@')
      ? await store.getViewerAccountByEmail(login.toLowerCase())
      : await store.getViewerAccountByUsername(normalizeUsername(login));
    const passwordValid = await verifyPassword(body.password, account?.passwordHash ?? passwordDummyHash);
    if (!account || account.status !== 'active' || !passwordValid) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль' });
    }
    const updated = await store.updateViewerAccount(account.id, { lastLoginAt: now() });
    await audit(request, 'viewer.login', 'viewer_account', account.id, null, { status: 'success' }, { id: account.id, roles: ['viewer'] });
    return viewerSession(updated ?? account, request);
  });

  app.post('/v1/auth/refresh', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const body = parseOrReply(viewerRefreshInput, request.body, reply);
    if (!body) return;
    const refreshTokenHash = viewerRefreshTokenHash(body.refreshToken, config.viewerRefreshTokenSecret);
    const nextRefreshToken = randomBytes(32).toString('base64url');
    const result = await store.consumeViewerSession(refreshTokenHash, {
      refreshTokenHash: viewerRefreshTokenHash(nextRefreshToken, config.viewerRefreshTokenSecret),
      expiresAt: new Date(Date.now() + config.viewerRefreshTokenTtlMs).toISOString(),
      deviceName: deviceNameFrom(request)
    });
    if (result.status === 'reused') {
      await store.revokeViewerSessionsForAccount(result.accountId, 'refresh_token_reuse');
      await audit(request, 'viewer.session.refresh_reuse', 'viewer_account', result.accountId, null, { status: 'all_sessions_revoked' }, { id: result.accountId, roles: ['viewer'] });
      return reply.code(401).send({ error: 'REFRESH_TOKEN_REUSED', message: 'Сессия завершена в целях безопасности. Войди снова.' });
    }
    if (result.status !== 'rotated') return reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN', message: 'Сессия недействительна. Войди снова.' });
    const account = await store.getViewerAccount(result.session.accountId);
    if (!account || account.status !== 'active') {
      await store.revokeViewerSession(result.session.id, 'account_inactive');
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Сессия недействительна. Войди снова.' });
    }
    await audit(request, 'viewer.session.refresh', 'viewer_session', result.session.id, null, { status: 'rotated' }, { id: account.id, roles: ['viewer'] });
    return {
      accessToken: app.jwt.sign({ sub: account.id, kind: 'viewer', sid: result.session.id }, { expiresIn: viewerAccessTokenTtlSeconds }),
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresIn: viewerAccessTokenTtlSeconds,
      refreshExpiresIn: Math.floor(config.viewerRefreshTokenTtlMs / 1000),
      viewer: viewerAccountPublic(account)
    };
  });

  app.post('/v1/auth/logout', { preHandler: app.requireViewer }, async (request, reply) => {
    await store.revokeViewerSession(request.user.sid, 'logout');
    await audit(request, 'viewer.session.logout', 'viewer_session', request.user.sid, null, { status: 'revoked' }, { id: request.user.sub, roles: ['viewer'] });
    return reply.code(204).send();
  });

  app.post('/v1/auth/logout-all', { preHandler: app.requireViewer }, async (request, reply) => {
    const revoked = await store.revokeViewerSessionsForAccount(request.user.sub, 'logout_all');
    await audit(request, 'viewer.session.logout_all', 'viewer_account', request.user.sub, null, { revokedSessions: revoked }, { id: request.user.sub, roles: ['viewer'] });
    return reply.code(204).send();
  });

  app.get('/v1/auth/me', { preHandler: app.requireViewer }, async (request, reply) => {
    const account = await store.getViewerAccount(request.user.sub);
    if (!account || account.status !== 'active') return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Сессия недействительна' });
    return { viewer: viewerAccountPublic(account) };
  });

  app.get('/v1/admin/overview', { preHandler: app.allowRoles(['superadmin', 'content_editor', 'moderator', 'analyst']) }, async () => store.overview());
  app.get('/v1/admin/content', { preHandler: app.allowRoles(['superadmin', 'content_editor', 'analyst']) }, async () => ({ items: await store.listContent() }));
  app.post('/v1/admin/content', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const body = parseOrReply(contentInput, request.body, reply);
    if (!body) return;
    const item = await store.createContent(body);
    audit(request, 'content.create', 'content', item.id, null, item);
    return reply.code(201).send({ item });
  });
  app.patch('/v1/admin/content/:id', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const params = parseOrReply(contentParams, request.params, reply);
    const body = parseOrReply(contentPatch, request.body, reply);
    if (!params || !body) return;
    const before = await store.getContent(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    // Any material change to the rights passport invalidates its legal approval.
    const passportKeys = ['ageRating', 'rightsBasis', 'rightsHolder', 'licenseReference', 'territories', 'startsAt', 'endsAt', 'audioLanguages', 'subtitleLanguages'];
    const rightsChanged = body.compliance && passportKeys.some((key) => JSON.stringify(body.compliance[key] ?? null) !== JSON.stringify(before.compliance?.[key] ?? null));
    const patch = body.compliance
      ? {
          ...body,
          compliance: rightsChanged
            ? { ...body.compliance, verifiedAt: null, verifiedBy: null, verificationReference: null }
            : { ...body.compliance, verifiedAt: before.compliance?.verifiedAt ?? null, verifiedBy: before.compliance?.verifiedBy ?? null, verificationReference: before.compliance?.verificationReference ?? null }
        }
      : body;
    const item = await store.updateContent(params.id, patch);
    audit(request, 'content.update', 'content', item.id, before, item);
    return { item };
  });

  app.post('/v1/admin/content/:id/submit-review', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const params = parseOrReply(contentParams, request.params, reply);
    const body = parseOrReply(submitReviewInput, request.body, reply);
    if (!params || !body) return;
    const before = await store.getContent(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    if (!['draft', 'unpublished'].includes(before.status)) return lifecycleConflict(reply, before, 'На проверку можно отправить только черновик или снятый с показа материал');
    const item = await store.updateContent(params.id, { status: 'review', scheduledAt: null, unpublishedReason: null });
    await audit(request, 'content.submit_review', 'content', item.id, before, { ...item, submissionNote: body.note ?? null });
    return { item };
  });

  app.post('/v1/admin/content/:id/verify-rights', { preHandler: app.allowRoles(['superadmin', 'legal_reviewer']) }, async (request, reply) => {
    const params = parseOrReply(contentParams, request.params, reply);
    const body = parseOrReply(rightsVerificationInput, request.body, reply);
    if (!params || !body) return;
    const before = await store.getContent(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    const blocks = contentPublicationBlocks(before, now(), { ...publicationGate, requireLegalVerification: false });
    if (blocks.length) return reply.code(409).send({ error: 'RIGHTS_VERIFICATION_BLOCKED', message: 'Юридическая проверка невозможна: заполните паспорт публикации', blocks });
    const verifiedAt = now();
    const item = await store.updateContent(params.id, {
      compliance: {
        ...before.compliance,
        verifiedAt,
        verifiedBy: request.user.sub,
        verificationReference: body.reference
      }
    });
    await audit(request, 'content.rights.verify', 'content', item.id, before, item);
    return { item };
  });

  app.post('/v1/admin/content/:id/publish', { preHandler: app.allowRoles(['superadmin']) }, async (request, reply) => {
    const params = parseOrReply(contentParams, request.params, reply);
    const body = parseOrReply(publishInput, request.body, reply);
    if (!params || !body) return;
    const before = await store.getContent(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    if (before.status !== 'review') return lifecycleConflict(reply, before, 'Опубликовать можно только материал, прошедший этап review');
    const publicationAt = body.scheduledAt ?? now();
    const publicationBlocks = contentPublicationBlocks(before, publicationAt, publicationGate);
    if (publicationBlocks.length) {
      return reply.code(409).send({
        error: 'PUBLISH_BLOCKED_BY_COMPLIANCE',
        message: 'Публикация заблокирована: заполните права, возрастной рейтинг и доступность контента',
        blocks: publicationBlocks
      });
    }

    if (body.scheduledAt) {
      const scheduledAt = new Date(body.scheduledAt).toISOString();
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Время публикации должно быть в будущем' });
      }
      const item = await store.updateContent(params.id, { status: 'scheduled', scheduledAt, publishedAt: null, unpublishedReason: null });
      await audit(request, 'content.schedule', 'content', item.id, before, item);
      return { item };
    }

    const item = await store.updateContent(params.id, { status: 'published', scheduledAt: null, publishedAt: now(), unpublishedReason: null });
    await audit(request, 'content.publish', 'content', item.id, before, item);
    return { item };
  });

  app.post('/v1/admin/content/:id/unpublish', { preHandler: app.allowRoles(['superadmin']) }, async (request, reply) => {
    const params = parseOrReply(contentParams, request.params, reply);
    const body = parseOrReply(unpublishInput, request.body, reply);
    if (!params || !body) return;
    const before = await store.getContent(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    if (!['published', 'scheduled'].includes(before.status)) return lifecycleConflict(reply, before, 'Снять с показа можно только опубликованный или запланированный материал');
    const item = await store.updateContent(params.id, { status: 'unpublished', scheduledAt: null, unpublishedReason: body.reason });
    await audit(request, 'content.unpublish', 'content', item.id, before, item);
    return { item };
  });

  app.get('/v1/catalog', async (request) => {
    await promoteDueScheduledContent(request);
    return { items: (await store.listPublishedContent()).filter((item) => isPubliclyAvailable(item, now(), publicationGate)).map(publicContent) };
  });
  app.get('/v1/catalog/home', async (request) => catalogHome(request));
  app.get('/v1/catalog/:id', async (request, reply) => {
    await promoteDueScheduledContent(request);
    const params = parseOrReply(contentParams, request.params, reply);
    if (!params) return;
    const item = await store.getContent(params.id);
    if (!isPubliclyAvailable(item, now(), publicationGate)) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    return { item: publicContent(item) };
  });
  // Public comments are deliberately limited to moderated, published content.
  // Author account IDs, report metadata and moderation notes never leave staff APIs.
  app.get('/v1/content/:id/comments', async (request, reply) => {
    await promoteDueScheduledContent(request);
    const params = parseOrReply(contentParams, request.params, reply);
    const query = parseOrReply(publicCommentsQuery, request.query, reply);
    if (!params || !query) return;
    const content = await store.getContent(params.id);
    if (!isPubliclyAvailable(content, now(), publicationGate)) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    const items = await store.listPublicComments(content.id, query);
    return { items: items.map(publicComment) };
  });
  app.post('/v1/content/:id/comments', { preHandler: app.requireViewer, config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request, reply) => {
    const params = parseOrReply(contentParams, request.params, reply);
    const body = parseOrReply(commentCreateInput, request.body, reply);
    if (!params || !body) return;
    const [content, account] = await Promise.all([store.getContent(params.id), store.getViewerAccount(request.user.sub)]);
    if (!isPubliclyAvailable(content, now(), publicationGate)) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    if (!account || account.status !== 'active' || !account.emailVerifiedAt) return reply.code(403).send({ error: 'VERIFIED_VIEWER_REQUIRED', message: 'Подтверди e-mail, чтобы писать комментарии.' });
    const item = await store.createComment({ contentId: content.id, authorId: account.id, authorName: account.displayName, text: body.text });
    await audit(request, 'comment.create', 'comment', item.id, null, { status: item.status, contentId: item.contentId }, { id: account.id, roles: ['viewer'] });
    return reply.code(201).send({ item: viewerComment(item), message: 'Комментарий отправлен на модерацию.' });
  });
  app.post('/v1/comments/:id/report', { preHandler: app.requireViewer, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const params = parseOrReply(z.object({ id: z.string().uuid() }), request.params, reply);
    const body = parseOrReply(commentReportInput, request.body, reply);
    if (!params || !body) return;
    const [comment, account] = await Promise.all([store.getComment(params.id), store.getViewerAccount(request.user.sub)]);
    if (!comment || comment.status !== 'approved') return reply.code(404).send({ error: 'NOT_FOUND', message: 'Комментарий не найден' });
    const content = await store.getContent(comment.contentId);
    if (!isPubliclyAvailable(content, now(), publicationGate)) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Комментарий не найден' });
    if (!account || account.status !== 'active' || !account.emailVerifiedAt) return reply.code(403).send({ error: 'VERIFIED_VIEWER_REQUIRED', message: 'Подтверди e-mail, чтобы отправлять жалобы.' });
    if (comment.authorId === account.id) return reply.code(409).send({ error: 'CANNOT_REPORT_OWN_COMMENT', message: 'Нельзя пожаловаться на свой комментарий.' });
    try {
      const report = await store.createCommentReport({ commentId: comment.id, reporterId: account.id, reason: body.reason, note: body.note ?? null });
      await audit(request, 'comment.report', 'comment', comment.id, null, { reportId: report.id, reason: report.reason }, { id: account.id, roles: ['viewer'] });
      return reply.code(202).send({ accepted: true });
    } catch (error) {
      if (error.code === 'COMMENT_ALREADY_REPORTED' || error.code === '23505') return reply.code(409).send({ error: 'COMMENT_ALREADY_REPORTED', message: 'Ты уже отправлял жалобу на этот комментарий.' });
      throw error;
    }
  });
  app.post('/v1/comments/:id/delete', { preHandler: app.requireViewer, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const params = parseOrReply(z.object({ id: z.string().uuid() }), request.params, reply);
    if (!params) return;
    const comment = await store.getComment(params.id);
    if (!comment) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Комментарий не найден' });
    if (comment.authorId !== request.user.sub) return reply.code(403).send({ error: 'FORBIDDEN', message: 'Можно удалить только свой комментарий.' });
    const item = await store.updateComment(comment.id, 'deleted', 'Удалён автором');
    await store.resolveCommentReports?.(comment.id);
    await audit(request, 'comment.delete_self', 'comment', item.id, { status: comment.status }, { status: item.status }, { id: request.user.sub, roles: ['viewer'] });
    return reply.code(204).send();
  });
  app.get('/v1/home', async (request) => catalogHome(request));

  app.post('/v1/privacy/deletion-requests', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const body = parseOrReply(publicRequestInput, request.body, reply);
    if (!body) return;
    if (config.production && (!config.publicBaseUrl || (!config.mailer && !config.mailerWebhookUrl))) {
      return reply.code(503).send({ error: 'DELETION_EMAIL_UNAVAILABLE', message: 'Сервис подтверждения удаления временно недоступен. Обратись в поддержку.' });
    }
    const token = randomBytes(32).toString('base64url');
    const verificationExpiresAt = new Date(Date.now() + config.deletionVerificationTtlMs).toISOString();
    const item = await store.createPublicRequest({
      type: 'deletion',
      status: 'awaiting_verification',
      email: body.email.toLowerCase(),
      accountEmail: body.accountEmail?.toLowerCase() ?? null,
      message: body.message ?? '',
      verificationTokenHash: deletionTokenHash(token, config.deletionVerificationSecret),
      verificationExpiresAt
    });
    await audit(request, 'privacy.deletion_request.create', 'public_request', item.id, null, { type: item.type, status: item.status, verificationExpiresAt });
    if (config.production) {
      try {
        await sendDeletionVerification(config, item, token);
      } catch (error) {
        await store.updatePublicRequest(item.id, { status: 'rejected', resolutionNote: 'Не удалось отправить письмо подтверждения. Создай новый запрос позже.', resolvedAt: now() });
        await audit(request, 'privacy.deletion_request.delivery_failed', 'public_request', item.id, { type: item.type, status: item.status }, { type: item.type, status: 'rejected', reason: error.message });
        request.log.error({ err: error, requestId: item.id }, 'Deletion verification email delivery failed');
        return reply.code(503).send({ error: 'DELETION_EMAIL_UNAVAILABLE', message: 'Не удалось отправить письмо подтверждения. Попробуй ещё раз позже.' });
      }
    }
    const response = { requestId: item.id, status: item.status, verificationRequired: true };
    // No mail provider is connected yet. The token is exposed only in an explicitly
    // development-only preview so it cannot leak in Railway/production responses.
    if (!config.production && config.allowDevTokens) response.developmentVerification = { token, verifyPath: `/v1/privacy/deletion-requests/${item.id}/verify`, expiresAt: verificationExpiresAt };
    return reply.code(202).send(response);
  });

  app.post('/v1/privacy/deletion-requests/:id/verify', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (request, reply) => {
    const params = parseOrReply(publicRequestParams, request.params, reply);
    const body = parseOrReply(deletionVerificationInput, request.body, reply);
    if (!params || !body) return;
    const item = await store.getPublicRequest?.(params.id);
    // Deliberately return the same response for unknown, already-used and invalid
    // tokens: this endpoint must not become an account/request enumeration oracle.
    const invalid = !item || item.type !== 'deletion' || item.verifiedAt || !item.verificationTokenHash || !item.verificationExpiresAt
      || new Date(item.verificationExpiresAt).getTime() < Date.now()
      || !safeEqualText(item.verificationTokenHash, deletionTokenHash(body.token, config.deletionVerificationSecret));
    if (invalid) return reply.code(400).send({ error: 'VERIFICATION_INVALID', message: 'Ссылка подтверждения недействительна или истекла. Создай новый запрос на удаление.' });
    const verifiedAt = now();
    const updated = await store.updatePublicRequest(params.id, {
      status: 'received',
      verifiedAt,
      verificationTokenHash: null
    });
    await audit(request, 'privacy.deletion_request.verify', 'public_request', updated.id, { type: item.type, status: item.status }, { type: updated.type, status: updated.status, verifiedAt });
    return { requestId: updated.id, status: updated.status, verified: true };
  });

  app.post('/v1/support/requests', { config: { rateLimit: { max: 8, timeWindow: '1 hour' } } }, async (request, reply) => {
    const body = parseOrReply(publicRequestInput, request.body, reply);
    if (!body) return;
    const item = await store.createPublicRequest({
      type: 'support',
      email: body.email.toLowerCase(),
      accountEmail: body.accountEmail?.toLowerCase() ?? null,
      message: body.message ?? ''
    });
    await audit(request, 'support.request.create', 'public_request', item.id, null, { type: item.type, status: item.status });
    return reply.code(202).send({ requestId: item.id, status: item.status });
  });

  app.get('/v1/admin/requests', { preHandler: app.allowRoles(['superadmin', 'support']) }, async (request, reply) => {
    const query = parseOrReply(publicRequestQuery, request.query, reply);
    if (!query) return;
    return { items: (await store.listPublicRequests(query)).map(publicRequestForStaff) };
  });

  app.patch('/v1/admin/requests/:id', { preHandler: app.allowRoles(['superadmin', 'support']) }, async (request, reply) => {
    const params = parseOrReply(publicRequestParams, request.params, reply);
    const body = parseOrReply(publicRequestAction, request.body, reply);
    if (!params || !body) return;
    const before = await store.getPublicRequest?.(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Обращение не найдено' });
    if (before.type === 'deletion' && body.status === 'completed' && !before.verifiedAt) {
      return reply.code(409).send({ error: 'DELETION_NOT_VERIFIED', message: 'Нельзя завершить удаление: владелец ещё не подтвердил запрос.' });
    }
    const item = await store.updatePublicRequest(params.id, {
      status: body.status,
      resolutionNote: body.note ?? null,
      resolvedAt: ['completed', 'rejected'].includes(body.status) ? now() : null
    });
    await audit(request, 'public_request.update', 'public_request', item.id, { type: before.type, status: before.status }, { type: item.type, status: item.status });
    return { item: publicRequestForStaff(item) };
  });

  app.get('/v1/admin/home/slots', { preHandler: app.allowRoles(['superadmin', 'content_editor', 'analyst']) }, async () => ({ items: await store.listHomeSlots() }));
  app.patch('/v1/admin/home/slots', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const body = parseOrReply(homeSlotsInput, request.body, reply);
    if (!body) return;
    const existing = await Promise.all(body.contentIds.map((id) => store.getContent(id)));
    const missing = body.contentIds.filter((id, index) => !existing[index]);
    if (missing.length) return reply.code(400).send({ error: 'INVALID_CONTENT', message: 'Одна или несколько карточек не найдены', ids: missing });
    const previous = (await store.listHomeSlots()).map((item) => item.id);
    const items = await store.replaceHomeSlots(body.contentIds);
    audit(request, 'home.reorder', 'home_slot', 'home', previous, items.map((item) => item.id));
    return { items };
  });

  const bannerForStudio = async (banner) => {
    const media = banner.mediaId ? await store.getMedia(banner.mediaId) : null;
    return {
      ...banner,
      media: media?.kind === 'banner' ? { id: media.id, src: `/v1/media/${media.id}`, name: media.fileName, size: media.size } : null
    };
  };

  const validateBannerLinks = async (banner, reply) => {
    const content = await store.getContent(banner.contentId);
    if (!content) {
      reply.code(400).send({ error: 'INVALID_CONTENT', message: 'Привязанный контент не найден' });
      return false;
    }
    if (banner.mediaId) {
      const media = await store.getMedia(banner.mediaId);
      if (!media || media.kind !== 'banner') {
        reply.code(400).send({ error: 'INVALID_BANNER_MEDIA', message: 'Изображение баннера не найдено' });
        return false;
      }
    }
    return true;
  };

  app.get('/v1/admin/banners', { preHandler: app.allowRoles(['superadmin', 'content_editor', 'analyst']) }, async () => ({
    items: await Promise.all((await store.listBanners()).map(bannerForStudio))
  }));
  app.post('/v1/admin/banners', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const body = parseOrReply(bannerInput, request.body, reply);
    if (!body || !(await validateBannerLinks(body, reply))) return;
    const item = await store.createBanner({ ...body, mediaId: body.mediaId ?? null });
    await audit(request, 'banner.create', 'banner', item.id, null, item);
    return reply.code(201).send({ item: await bannerForStudio(item) });
  });
  app.patch('/v1/admin/banners/:id', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const params = parseOrReply(bannerParams, request.params, reply);
    const body = parseOrReply(bannerPatch, request.body, reply);
    if (!params || !body) return;
    const before = await store.getBanner(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Баннер не найден' });
    const next = { ...before, ...body };
    if (!(await validateBannerLinks(next, reply))) return;
    const item = await store.updateBanner(params.id, body);
    await audit(request, 'banner.update', 'banner', item.id, before, item);
    return { item: await bannerForStudio(item) };
  });
  app.delete('/v1/admin/banners/:id', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const params = parseOrReply(bannerParams, request.params, reply);
    if (!params) return;
    const item = await store.deleteBanner(params.id);
    if (!item) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Баннер не найден' });
    await audit(request, 'banner.delete', 'banner', item.id, item, null);
    return reply.code(204).send();
  });
  app.put('/v1/admin/banners/order', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    const body = parseOrReply(bannerOrderInput, request.body, reply);
    if (!body) return;
    const previous = await store.listBanners();
    if (previous.length !== body.ids.length || previous.some((item) => !body.ids.includes(item.id))) {
      return reply.code(400).send({ error: 'INVALID_BANNER_ORDER', message: 'Передай полный список существующих баннеров без повторов' });
    }
    const byId = new Map(previous.map((item) => [item.id, item]));
    const items = await store.replaceBanners(body.ids.map((id) => byId.get(id)));
    await audit(request, 'banner.reorder', 'banner', 'home', previous.map((item) => item.id), items.map((item) => item.id));
    return { items: await Promise.all(items.map(bannerForStudio)) };
  });

  app.get('/v1/admin/comments', { preHandler: app.allowRoles(['superadmin', 'moderator', 'analyst']) }, async (request, reply) => {
    const query = parseOrReply(z.object({ status: z.enum(commentStatuses).optional() }), request.query, reply);
    if (!query) return;
    return { items: await store.listComments(query.status) };
  });
  app.get('/v1/admin/comment-reports', { preHandler: app.allowRoles(['superadmin', 'moderator', 'analyst']) }, async (request, reply) => {
    const query = parseOrReply(commentReportQuery, request.query, reply);
    if (!query) return;
    const reports = await store.listCommentReports(query);
    return { items: reports.map(({ reporterId, ...safe }) => safe) };
  });
  app.patch('/v1/admin/comments/:id', { preHandler: app.allowRoles(['superadmin', 'moderator']) }, async (request, reply) => {
    const params = parseOrReply(z.object({ id: z.string().min(1).max(80) }), request.params, reply);
    const body = parseOrReply(commentActionInput, request.body, reply);
    if (!params || !body) return;
    const before = (await store.listComments()).find((item) => item.id === params.id);
    const item = await store.updateComment(params.id, body.status, body.note);
    if (!item) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Комментарий не найден' });
    await store.resolveCommentReports?.(item.id);
    audit(request, 'comment.moderate', 'comment', item.id, before, item);
    return { item };
  });

  app.post('/v1/events/playback', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = parseOrReply(playbackInput, request.body, reply);
    if (!body) return;
    if (!await store.getContent(body.contentId)) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент не найден' });
    await store.addPlayback({ ...body, viewerId: request.user?.sub ?? null });
    return reply.code(202).send({ accepted: true });
  });

  // Studio sees processing state but never receives an object-storage key,
  // multipart upload id, or a source-media URL. Those stay server-side.
  app.get('/v1/admin/assets', { preHandler: app.allowRoles(['superadmin', 'content_editor', 'legal_reviewer']) }, async (request, reply) => {
    const query = parseOrReply(mediaListQuery, request.query, reply);
    if (!query) return;
    const assets = await store.listMedia?.({ limit: query.limit ?? 100 }) ?? [];
    const sourceAssetIds = assets.filter((asset) => asset.kind === 'video_source').map((asset) => asset.id);
    const jobs = await store.listMediaJobs?.({ sourceAssetIds }) ?? [];
    const jobsBySource = new Map(jobs.map((job) => [job.sourceAssetId, job]));
    return {
      items: assets
        .filter((asset) => asset.kind === 'video_source')
        .map((asset) => {
          const job = jobsBySource.get(asset.id);
          return {
          id: asset.id,
          kind: asset.kind,
          relation: asset.relation,
          status: asset.status,
          contentId: asset.contentId,
          fileName: asset.fileName,
          contentType: asset.contentType,
          size: asset.size,
          durationMs: asset.durationMs,
          processingState: asset.metadata?.processingState ?? 'not_started',
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
          completedAt: asset.completedAt,
          queuedAt: asset.queuedAt,
          abortedAt: asset.abortedAt
          , job: job ? {
            status: job.status,
            attempt: job.attempt,
            maxAttempts: job.maxAttempts,
            availableAt: job.availableAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt
          } : null
        }; })
    };
  });

  // Worker-only queue API. It returns the private source key only after a
  // short lease is atomically claimed; Studio never receives that key.
  app.post('/v1/internal/media-jobs/claim', { preHandler: app.requireMediaWorker }, async (request, reply) => {
    const body = parseOrReply(workerClaimInput, request.body, reply);
    if (!body) return;
    const leaseToken = randomBytes(32).toString('base64url');
    const job = await store.claimMediaJob?.({ workerId: body.workerId, leaseToken, leaseMs: mediaJobLeaseMs, at: now() });
    if (!job) return reply.code(204).send();
    return {
      job: {
        jobId: job.id,
        sourceAssetId: job.sourceAssetId,
        contentId: job.contentId,
        sourceKey: job.sourceKey,
        contentType: job.contentType,
        sizeBytes: job.sizeBytes,
        attempt: job.attempt,
        leaseToken,
        leaseExpiresAt: job.leaseExpiresAt
      }
    };
  });

  app.post('/v1/internal/media-jobs/:id/settle', { preHandler: app.requireMediaWorker }, async (request, reply) => {
    const params = parseOrReply(workerJobParams, request.params, reply);
    const body = parseOrReply(workerJobSettleInput, request.body, reply);
    if (!params || !body) return;
    const job = await store.getMediaJob?.(params.id);
    if (!job) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (body.outcome === 'succeeded') {
      const rendition = await store.getMedia(body.renditionAssetId);
      if (!rendition || rendition.contentId !== job.contentId || rendition.relation !== 'rendition' || rendition.kind !== 'hls' || rendition.status !== 'ready') {
        return reply.code(409).send({ error: 'RENDITION_NOT_READY' });
      }
    }
    const retryAt = body.outcome === 'retryable_failure'
      ? new Date(Date.now() + (body.retryAfterSeconds ?? 60) * 1000).toISOString()
      : null;
    const settled = await store.settleMediaJob?.(params.id, { leaseToken: body.leaseToken, outcome: body.outcome, errorCode: body.errorCode ?? null, retryAt, at: now() });
    if (!settled || settled.status === 'lease_lost') return reply.code(409).send({ error: 'JOB_LEASE_LOST' });
    if (settled.status === 'not_found') return reply.code(404).send({ error: 'NOT_FOUND' });
    if (body.outcome === 'succeeded' && settled.status === 'updated') {
      await store.updateMedia(job.sourceAssetId, { status: 'processed', durationMs: (await store.getMedia(body.renditionAssetId)).durationMs, metadata: { ...(await store.getMedia(job.sourceAssetId)).metadata, processingState: 'ready', renditionAssetId: body.renditionAssetId } });
    } else if (body.outcome !== 'succeeded' && settled.status === 'updated') {
      const source = await store.getMedia(job.sourceAssetId);
      await store.updateMedia(job.sourceAssetId, { status: settled.job.status === 'dead' ? 'failed' : 'queued', metadata: { ...source.metadata, processingState: settled.job.status === 'dead' ? 'failed' : 'queued' } });
    }
    await audit(request, `media.transcode.${body.outcome}`, 'media_job', params.id, null, { status: settled.job.status, attempt: settled.job.attempt }, { id: `worker:${job.workerId ?? 'unknown'}`, roles: ['media_worker'] });
    return { job: { id: settled.job.id, status: settled.job.status, attempt: settled.job.attempt, maxAttempts: settled.job.maxAttempts } };
  });

  // This is the only viewer-facing entry point for video. It does not return
  // object-storage keys, presigned bucket URLs, or a made-up playback URL.
  // The returned path is an API gateway that checks the short-lived session on
  // every manifest/segment request.
  app.post('/v1/playback/sessions', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = parseOrReply(playbackSessionInput, request.body, reply);
    if (!body) return;
    await promoteDueScheduledContent(request);
    const content = await store.getContent(body.contentId);
    if (!content || !isPubliclyAvailable(content, now(), publicationGate)) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Контент недоступен' });
    }
    if (content.access !== 'free') {
      return reply.code(403).send({
        error: 'ENTITLEMENT_REQUIRED',
        message: 'Для этого контента требуется подтверждённое право просмотра. Покупки и подписки ещё не подключены.',
        access: content.access
      });
    }
    if (!mediaStore || typeof mediaStore.get !== 'function') {
      return reply.code(503).send({ error: 'PLAYBACK_UNAVAILABLE', message: 'Видеохранилище ещё не подключено' });
    }
    const rendition = await readyHlsRenditionFor(content.id);
    if (!rendition) {
      return reply.code(409).send({ error: 'PLAYBACK_NOT_READY', message: 'Обработанная версия HLS для просмотра ещё не готова' });
    }
    const sessionId = randomUUID();
    const token = app.jwt.sign({ kind: 'playback', cid: content.id, rid: rendition.id, sid: sessionId }, { expiresIn: 300 });
    await audit(request, 'playback.session.grant', 'content', content.id, null, { access: 'free', renditionId: rendition.id, sessionId });
    return reply.code(201).send({
      sessionId,
      expiresIn: 300,
      manifestUrl: `/v1/playback/${token}/master.m3u8`
    });
  });

  app.get('/v1/playback/:token/*', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (request, reply) => {
    const params = request.params;
    let session;
    try {
      session = app.jwt.verify(params.token);
    } catch {
      return reply.code(401).send({ error: 'PLAYBACK_SESSION_INVALID', message: 'Сессия просмотра недействительна или истекла' });
    }
    const requestedPath = params['*'];
    if (session?.kind !== 'playback' || !session.cid || !session.rid || !safeHlsPath(requestedPath)) {
      return reply.code(401).send({ error: 'PLAYBACK_SESSION_INVALID', message: 'Сессия просмотра недействительна' });
    }
    const content = await store.getContent(session.cid);
    if (!content || !isPubliclyAvailable(content, now(), publicationGate) || content.access !== 'free') {
      return reply.code(403).send({ error: 'PLAYBACK_ACCESS_REVOKED', message: 'Доступ к просмотру больше недоступен' });
    }
    const rendition = await readyHlsRenditionFor(content.id);
    if (!rendition || rendition.id !== session.rid) {
      return reply.code(403).send({ error: 'PLAYBACK_ACCESS_REVOKED', message: 'Версия для просмотра больше недоступна' });
    }
    const hls = rendition.metadata.playback.hls;
    if (hls.manifestKey !== `${hls.prefix}master.m3u8`) {
      request.log.error({ renditionId: rendition.id }, 'Invalid HLS rendition contract');
      return reply.code(502).send({ error: 'PLAYBACK_RENDITION_INVALID', message: 'Версия видео требует повторной обработки' });
    }
    const storageKey = requestedPath === 'master.m3u8' ? hls.manifestKey : `${hls.prefix}${requestedPath}`;
    try {
      const object = await mediaStore.get(storageKey);
      if (requestedPath.endsWith('.m3u8')) {
        const chunks = [];
        for await (const chunk of object.Body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const manifest = Buffer.concat(chunks);
        if (!hlsManifestIsGatewaySafe(manifest)) {
          request.log.error({ renditionId: rendition.id }, 'Unsafe HLS manifest rejected');
          return reply.code(502).send({ error: 'PLAYBACK_RENDITION_INVALID', message: 'Версия видео требует повторной обработки' });
        }
        reply.header('content-type', 'application/vnd.apple.mpegurl');
        reply.header('cache-control', 'no-store');
        return reply.send(manifest);
      }
      reply.header('content-type', object.ContentType || 'application/octet-stream');
      reply.header('cache-control', 'private, no-store');
      reply.header('accept-ranges', 'bytes');
      return reply.send(object.Body);
    } catch (error) {
      request.log.error(error);
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
  });

  // The browser uploads directly to private object storage. The API never
  // proxies a multi-gigabyte source file through Railway or exposes it via a
  // public media route.
  app.post('/v1/admin/assets/upload-init', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    if (!multipartStoreAvailable()) return reply.code(503).send({ error: 'MEDIA_STORAGE_UNAVAILABLE', message: 'Постоянное хранилище для загрузки видео ещё не подключено' });
    const body = parseOrReply(uploadInitInput, request.body, reply);
    if (!body) return;
    const extension = sourceVideoExtension(body.fileName, body.contentType);
    if (!extension) {
      return reply.code(400).send({
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Поддерживаются только MP4, MOV и WebM с соответствующим MIME-типом'
      });
    }
    if (body.contentId && !await store.getContent(body.contentId)) {
      return reply.code(404).send({ error: 'CONTENT_NOT_FOUND', message: 'Связанный контент не найден' });
    }

    const assetId = randomUUID();
    const partCount = Math.ceil(body.size / multipartPartSize);
    if (partCount > 10_000) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Размер файла превышает лимит multipart-загрузки' });
    }
    const storageKey = `incoming/${new Date().toISOString().slice(0, 10)}/${assetId}/source.${extension}`;
    let upload;
    try {
      upload = await mediaStore.createMultipartUpload({
        storageKey,
        contentType: body.contentType,
        metadata: { origin: 'sakhatube-studio', assetid: assetId }
      });
      const asset = await store.createMedia({
        id: assetId,
        kind: 'video_source',
        relation: 'source',
        status: 'uploading',
        storageKey,
        fileName: body.fileName,
        contentType: body.contentType,
        size: body.size,
        contentId: body.contentId ?? null,
        uploadId: upload.uploadId,
        partSize: multipartPartSize,
        partCount,
        durationMs: null,
        metadata: { durationState: 'pending', processingState: 'not_started' }
      });
      const page = await buildUploadPartPage(asset);
      await audit(request, 'media.upload.init', 'media_asset', asset.id, null, asset);
      return reply.code(201).send({
        asset,
        uploadId: upload.uploadId,
        partSize: multipartPartSize,
        partCount,
        ...page
      });
    } catch (error) {
      if (upload?.uploadId) {
        try { await mediaStore.abortMultipartUpload({ storageKey, uploadId: upload.uploadId }); } catch (abortError) { request.log.error(abortError); }
      }
      throw error;
    }
  });

  app.get('/v1/admin/assets/:id/upload-parts', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    if (!multipartStoreAvailable()) return reply.code(503).send({ error: 'MEDIA_STORAGE_UNAVAILABLE', message: 'Постоянное хранилище для загрузки видео ещё не подключено' });
    const params = parseOrReply(mediaParams, request.params, reply);
    const query = parseOrReply(uploadPartsQuery, request.query, reply);
    if (!params || !query) return;
    const asset = await store.getMedia(params.id);
    if (!asset) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Медиафайл не найден' });
    if (asset.status !== 'uploading' || !asset.uploadId || !asset.partCount) {
      return reply.code(409).send({ error: 'UPLOAD_NOT_ACTIVE', message: 'Для этого медиафайла нет активной multipart-загрузки' });
    }
    const page = await buildUploadPartPage(asset, query.from ?? 1, query.limit ?? multipartPartPageSize);
    return { assetId: asset.id, partSize: asset.partSize, partCount: asset.partCount, ...page };
  });

  app.post('/v1/admin/assets/:id/upload-complete', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    if (!multipartStoreAvailable()) return reply.code(503).send({ error: 'MEDIA_STORAGE_UNAVAILABLE', message: 'Постоянное хранилище для загрузки видео ещё не подключено' });
    const params = parseOrReply(mediaParams, request.params, reply);
    const body = parseOrReply(uploadCompleteInput, request.body, reply);
    if (!params || !body) return;
    const before = await store.getMedia(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Медиафайл не найден' });
    if (!before.contentId) return reply.code(409).send({ error: 'CONTENT_REQUIRED_FOR_TRANSCODE', message: 'Перед обработкой привяжите видео к материалу' });
    if (before.status !== 'uploading' || !before.uploadId || !before.partCount) {
      return reply.code(409).send({ error: 'UPLOAD_NOT_ACTIVE', message: 'Эта загрузка уже завершена или отменена' });
    }
    const orderedParts = [...body.parts].sort((left, right) => left.number - right.number);
    const completeSet = orderedParts.length === before.partCount
      && orderedParts.every((part, index) => part.number === index + 1);
    if (!completeSet) {
      return reply.code(400).send({
        error: 'INVALID_UPLOAD_PARTS',
        message: `Нужен полный список уникальных частей от 1 до ${before.partCount}`
      });
    }
    try {
      await mediaStore.completeMultipartUpload({
        storageKey: before.storageKey,
        uploadId: before.uploadId,
        parts: orderedParts
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: 'UPLOAD_COMPLETE_FAILED', message: 'Не удалось подтвердить загрузку в хранилище. Повторите завершение.' });
    }
    const uploaded = await store.updateMedia(before.id, {
      status: 'uploaded',
      completedAt: now(),
      metadata: { ...before.metadata, processingState: 'waiting' }
    });
    await audit(request, 'media.upload.complete', 'media_asset', uploaded.id, before, uploaded);
    const queued = await store.updateMedia(uploaded.id, {
      status: 'queued',
      queuedAt: now(),
      metadata: { ...uploaded.metadata, processingState: 'queued' }
    });
    const job = await store.createMediaJob({
      sourceAssetId: queued.id,
      contentId: queued.contentId,
      sourceKey: queued.storageKey,
      contentType: queued.contentType,
      sizeBytes: queued.size
    });
    await audit(request, 'media.transcode.queue', 'media_asset', queued.id, uploaded, queued);
    return { asset: queued, job: { id: job.id, status: job.status } };
  });

  app.post('/v1/admin/assets/:id/upload-abort', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    if (!multipartStoreAvailable()) return reply.code(503).send({ error: 'MEDIA_STORAGE_UNAVAILABLE', message: 'Постоянное хранилище для загрузки видео ещё не подключено' });
    const params = parseOrReply(mediaParams, request.params, reply);
    if (!params) return;
    const before = await store.getMedia(params.id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Медиафайл не найден' });
    if (before.status !== 'uploading' || !before.uploadId) {
      return reply.code(409).send({ error: 'UPLOAD_NOT_ACTIVE', message: 'Активная multipart-загрузка не найдена' });
    }
    try {
      await mediaStore.abortMultipartUpload({ storageKey: before.storageKey, uploadId: before.uploadId });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: 'UPLOAD_ABORT_FAILED', message: 'Не удалось отменить загрузку в хранилище. Повторите попытку.' });
    }
    const item = await store.updateMedia(before.id, {
      status: 'aborted',
      abortedAt: now(),
      metadata: { ...before.metadata, processingState: 'aborted' }
    });
    await audit(request, 'media.upload.abort', 'media_asset', item.id, before, item);
    return { asset: item };
  });

  app.post('/v1/admin/media/banner', { preHandler: app.allowRoles(['superadmin', 'content_editor']) }, async (request, reply) => {
    if (!mediaStore) return reply.code(503).send({ error: 'MEDIA_STORAGE_UNAVAILABLE', message: 'Постоянное хранилище медиа ещё не подключено' });
    const part = await request.file();
    if (!part) return reply.code(400).send({ error: 'FILE_REQUIRED', message: 'Выберите изображение' });
    if (!bannerMimeTypes.has(part.mimetype)) return reply.code(400).send({ error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Поддерживаются JPG, PNG и WebP' });
    const body = await part.toBuffer();
    if (part.file.truncated) return reply.code(413).send({ error: 'FILE_TOO_LARGE', message: 'Изображение больше 15 МБ' });
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[part.mimetype];
    const mediaId = randomUUID();
    const storageKey = `banners/${new Date().toISOString().slice(0, 10)}/${mediaId}.${extension}`;
    await mediaStore.put({ storageKey, body, contentType: part.mimetype });
    try {
      const item = await store.createMedia({ kind: 'banner', storageKey, fileName: part.filename || `banner.${extension}`, contentType: part.mimetype, size: body.length });
      audit(request, 'media.banner.upload', 'media_asset', item.id, null, item);
      return reply.code(201).send({ item: { ...item, url: `/v1/media/${item.id}` } });
    } catch (error) {
      await mediaStore.remove(storageKey);
      throw error;
    }
  });

  app.get('/v1/media/:id', async (request, reply) => {
    if (!mediaStore) return reply.code(404).send({ error: 'NOT_FOUND' });
    const params = parseOrReply(z.object({ id: z.string().uuid() }), request.params, reply);
    if (!params) return;
    const item = await store.getMedia(params.id);
    if (!item) return reply.code(404).send({ error: 'NOT_FOUND' });
    // Raw source files are private upload inputs, never viewer media. A later
    // entitlement-aware playback path will expose processed renditions only.
    // Viewer HLS files are always fetched through /v1/playback with a scoped
    // session. This route is intentionally limited to public images.
    if (item.kind !== 'banner' || item.relation === 'source' || item.storageKey.startsWith('incoming/')) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    try {
      const object = await mediaStore.get(item.storageKey);
      reply.header('content-type', object.ContentType || item.contentType);
      reply.header('cache-control', 'public, max-age=86400');
      return reply.send(object.Body);
    } catch (error) {
      request.log.error(error);
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
  });

  // Public only for explicitly marked temporary Creative Commons demo files.
  // Paid or private content must use a separate entitlement check and signed CDN URLs.
  app.get('/v1/demo-media/*', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!mediaStore) return reply.code(404).send({ error: 'NOT_FOUND' });
    const relativeKey = request.params['*'];
    if (typeof relativeKey !== 'string' || !relativeKey || relativeKey.includes('..') || relativeKey.includes('\\')) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    const range = request.headers.range;
    if (range && !/^bytes=\d*-\d*$/.test(range)) return reply.code(416).send({ error: 'RANGE_NOT_SATISFIABLE' });
    try {
      const object = await mediaStore.get(`demo-media/${relativeKey}`, range);
      reply.header('content-type', object.ContentType || 'application/octet-stream');
      reply.header('cache-control', relativeKey.endsWith('.m3u8') ? 'no-cache' : 'public, max-age=86400');
      reply.header('x-sakhatube-demo-media', 'true');
      // This route holds only temporary Creative Commons test media. Allow the
      // local file preview and the deployed app to render the same demo assets.
      reply.header('cross-origin-resource-policy', 'cross-origin');
      reply.header('accept-ranges', 'bytes');
      if (object.ContentRange) reply.header('content-range', object.ContentRange);
      if (object.ContentLength !== undefined) reply.header('content-length', object.ContentLength);
      if (object.ContentRange) reply.code(206);
      return reply.send(object.Body);
    } catch (error) {
      request.log.error(error);
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
  });

  if (options.serveStatic !== false) {
    app.register(fastifyStatic, { root: projectRoot, serve: false });
    const legalPages = new Map([
      ['/privacy', 'legal/privacy.html'],
      ['/terms', 'legal/terms.html'],
      ['/community-rules', 'legal/community-rules.html'],
      ['/support', 'legal/support.html'],
      ['/delete-account', 'legal/delete-account.html'],
      ['/verify-email', 'legal/verify-email.html']
    ]);
    for (const [route, file] of legalPages) {
      app.get(route, async (request, reply) => reply.type('text/html; charset=utf-8').sendFile(file));
    }
    app.get('/', async (request, reply) => reply.type('text/html; charset=utf-8').sendFile(publicFiles.get('/')));
    app.get('/:asset', async (request, reply) => {
      const file = publicFiles.get(`/${request.params.asset}`);
      if (!file) return reply.code(404).send({ error: 'NOT_FOUND' });
      return reply.sendFile(file);
    });
  }

  return app;
}
