import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const now = () => new Date().toISOString();

const mapContent = (row) => row && ({
  id: row.id,
  title: row.title,
  kind: row.kind,
  genre: row.genre,
  synopsis: row.synopsis,
  status: row.status,
  access: row.access,
  episodes: Number(row.episodes),
  views: Number(row.views),
  likes: Number(row.likes),
  compliance: row.compliance ?? null,
  scheduledAt: row.scheduled_at ? row.scheduled_at.toISOString() : null,
  publishedAt: row.published_at ? row.published_at.toISOString() : null,
  unpublishedReason: row.unpublished_reason ?? null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString()
});

const mapComment = (row) => row && ({
  id: row.id,
  contentId: row.content_id,
  authorId: row.author_id,
  authorName: row.author_name,
  text: row.body,
  status: row.status,
  moderationNote: row.moderation_note,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString()
});

const mapMedia = (row) => row && ({
  id: row.id,
  kind: row.kind,
  relation: row.relation,
  status: row.status,
  contentId: row.content_id,
  storageKey: row.storage_key,
  fileName: row.file_name,
  contentType: row.content_type,
  size: Number(row.size_bytes),
  durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
  uploadId: row.upload_id,
  partSize: row.part_size === null ? null : Number(row.part_size),
  partCount: row.part_count,
  metadata: row.metadata ?? {},
  completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  queuedAt: row.queued_at ? row.queued_at.toISOString() : null,
  abortedAt: row.aborted_at ? row.aborted_at.toISOString() : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at ? row.updated_at.toISOString() : row.created_at.toISOString()
});

const mapPublicRequest = (row) => row && ({
  id: row.id,
  type: row.type,
  email: row.email,
  accountEmail: row.account_email,
  message: row.message,
  status: row.status,
  verificationTokenHash: row.verification_token_hash,
  verificationExpiresAt: row.verification_expires_at ? row.verification_expires_at.toISOString() : null,
  verifiedAt: row.verified_at ? row.verified_at.toISOString() : null,
  resolutionNote: row.resolution_note,
  resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString()
});

async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      genre TEXT NOT NULL,
      synopsis TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      access TEXT NOT NULL,
      episodes INTEGER NOT NULL,
      views BIGINT NOT NULL DEFAULT 0,
      likes BIGINT NOT NULL DEFAULT 0,
      compliance JSONB,
      scheduled_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      unpublished_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE content_items ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
    ALTER TABLE content_items ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
    ALTER TABLE content_items ADD COLUMN IF NOT EXISTS unpublished_reason TEXT;
    ALTER TABLE content_items ADD COLUMN IF NOT EXISTS compliance JSONB;
    CREATE TABLE IF NOT EXISTS home_slots (
      slot_index INTEGER PRIMARY KEY,
      content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      moderation_note TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS playback_events (
      id UUID PRIMARY KEY,
      content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      viewer_id TEXT,
      session_id TEXT NOT NULL,
      event TEXT NOT NULL,
      position_ms INTEGER,
      error_code TEXT,
      received_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media_assets (
      id UUID PRIMARY KEY,
      kind TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'asset',
      status TEXT NOT NULL DEFAULT 'available',
      content_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
      storage_key TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      duration_ms BIGINT,
      upload_id TEXT,
      part_size BIGINT,
      part_count INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      completed_at TIMESTAMPTZ,
      queued_at TIMESTAMPTZ,
      aborted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS relation TEXT NOT NULL DEFAULT 'asset';
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available';
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS content_id TEXT REFERENCES content_items(id) ON DELETE SET NULL;
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS duration_ms BIGINT;
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS upload_id TEXT;
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS part_size BIGINT;
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS part_count INTEGER;
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS aborted_at TIMESTAMPTZ;
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
    UPDATE media_assets SET updated_at = created_at WHERE updated_at IS NULL;
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL,
      actor_id TEXT NOT NULL,
      roles JSONB NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_state JSONB,
      after_state JSONB,
      request_id TEXT,
      ip TEXT
    );
    CREATE TABLE IF NOT EXISTS public_requests (
      id UUID PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('deletion', 'support')),
      email TEXT NOT NULL,
      account_email TEXT,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('received', 'in_progress', 'completed', 'rejected')),
      verification_token_hash TEXT,
      verification_expires_at TIMESTAMPTZ,
      verified_at TIMESTAMPTZ,
      resolution_note TEXT,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE public_requests DROP CONSTRAINT IF EXISTS public_requests_status_check;
    ALTER TABLE public_requests ADD CONSTRAINT public_requests_status_check CHECK (status IN ('received', 'awaiting_verification', 'in_progress', 'completed', 'rejected'));
    ALTER TABLE public_requests ADD COLUMN IF NOT EXISTS verification_token_hash TEXT;
    ALTER TABLE public_requests ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;
    ALTER TABLE public_requests ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS comments_status_idx ON comments(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS playback_events_content_idx ON playback_events(content_id, received_at DESC);
    CREATE INDEX IF NOT EXISTS content_scheduled_idx ON content_items(status, scheduled_at) WHERE status = 'scheduled';
    CREATE INDEX IF NOT EXISTS media_assets_content_idx ON media_assets(content_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS media_assets_status_idx ON media_assets(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS public_requests_queue_idx ON public_requests(type, status, created_at ASC);
  `);
}

async function seed(pool, seed) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of seed.content) {
      await client.query(
        `INSERT INTO content_items (id, title, kind, genre, synopsis, status, access, episodes, views, likes, compliance, scheduled_at, published_at, unpublished_reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO UPDATE SET compliance = EXCLUDED.compliance
         WHERE content_items.compliance IS NULL`,
        [item.id, item.title, item.kind, item.genre, item.synopsis, item.status, item.access, item.episodes, item.views, item.likes, item.compliance ? JSON.stringify(item.compliance) : null, item.scheduledAt ?? null, item.publishedAt ?? null, item.unpublishedReason ?? null, item.createdAt, item.updatedAt]
      );
    }
    for (const [slotIndex, contentId] of seed.homeSlots.entries()) {
      await client.query('INSERT INTO home_slots (slot_index, content_id) VALUES ($1, $2) ON CONFLICT (slot_index) DO NOTHING', [slotIndex, contentId]);
    }
    for (const comment of seed.comments) {
      await client.query(
        `INSERT INTO comments (id, content_id, author_id, author_name, body, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [comment.id, comment.contentId, comment.authorId, comment.authorName, comment.text, comment.status, comment.createdAt, comment.updatedAt]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createPostgresStore(connectionString, seedData) {
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  await pool.query('SELECT 1');
  await migrate(pool);
  await seed(pool, seedData);

  return {
    async listContent() {
      const { rows } = await pool.query('SELECT * FROM content_items ORDER BY updated_at DESC');
      return rows.map(mapContent);
    },
    async getContent(id) {
      const { rows } = await pool.query('SELECT * FROM content_items WHERE id = $1', [id]);
      return mapContent(rows[0]);
    },
    async createContent(data) {
      const item = {
        id: randomUUID(),
        views: 0,
        likes: 0,
        status: 'draft',
        scheduledAt: null,
        publishedAt: null,
        unpublishedReason: null,
        compliance: null,
        createdAt: now(),
        updatedAt: now(),
        ...data
      };
      const { rows } = await pool.query(
        `INSERT INTO content_items (id, title, kind, genre, synopsis, status, access, episodes, views, likes, compliance, scheduled_at, published_at, unpublished_reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
        [item.id, item.title, item.kind, item.genre, item.synopsis, item.status, item.access, item.episodes, item.views, item.likes, item.compliance ? JSON.stringify(item.compliance) : null, item.scheduledAt, item.publishedAt, item.unpublishedReason, item.createdAt, item.updatedAt]
      );
      return mapContent(rows[0]);
    },
    async updateContent(id, patch) {
      const fields = {
        title: 'title',
        kind: 'kind',
        genre: 'genre',
        synopsis: 'synopsis',
        status: 'status',
        access: 'access',
        episodes: 'episodes',
        compliance: 'compliance',
        scheduledAt: 'scheduled_at',
        publishedAt: 'published_at',
        unpublishedReason: 'unpublished_reason'
      };
      const entries = Object.entries(patch).filter(([key]) => fields[key]);
      if (!entries.length) return this.getContent(id);
      const values = entries.map(([key, value]) => key === 'compliance' ? JSON.stringify(value) : value);
      const sets = entries.map(([key], index) => `${fields[key]} = $${index + 1}`);
      values.push(now(), id);
      const { rows } = await pool.query(`UPDATE content_items SET ${sets.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length} RETURNING *`, values);
      return mapContent(rows[0]);
    },
    async listHomeSlots() {
      const { rows } = await pool.query('SELECT c.* FROM home_slots h JOIN content_items c ON c.id = h.content_id ORDER BY h.slot_index ASC');
      return rows.map(mapContent);
    },
    async listPublishedContent() {
      const { rows } = await pool.query("SELECT * FROM content_items WHERE status = 'published' ORDER BY published_at DESC NULLS LAST, updated_at DESC");
      return rows.map(mapContent);
    },
    async listPublishedHomeSlots() {
      const { rows } = await pool.query("SELECT c.* FROM home_slots h JOIN content_items c ON c.id = h.content_id WHERE c.status = 'published' ORDER BY h.slot_index ASC");
      return rows.map(mapContent);
    },
    async publishDueContent(at = now()) {
      const { rows } = await pool.query(
        `UPDATE content_items
         SET status = 'published', scheduled_at = NULL, published_at = $1, unpublished_reason = NULL, updated_at = $1
         WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= $1
         RETURNING *`,
        [at]
      );
      return rows.map(mapContent);
    },
    async replaceHomeSlots(ids) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM home_slots');
        for (const [slotIndex, contentId] of ids.entries()) await client.query('INSERT INTO home_slots (slot_index, content_id) VALUES ($1, $2)', [slotIndex, contentId]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return this.listHomeSlots();
    },
    async listComments(status) {
      const { rows } = await pool.query(`SELECT * FROM comments ${status ? 'WHERE status = $1' : ''} ORDER BY updated_at DESC`, status ? [status] : []);
      return rows.map(mapComment);
    },
    async updateComment(id, status, moderationNote) {
      const { rows } = await pool.query('UPDATE comments SET status = $1, moderation_note = $2, updated_at = $3 WHERE id = $4 RETURNING *', [status, moderationNote ?? null, now(), id]);
      return mapComment(rows[0]);
    },
    async addPlayback(event) {
      await pool.query(
        `INSERT INTO playback_events (id, content_id, viewer_id, session_id, event, position_ms, error_code, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [randomUUID(), event.contentId, event.viewerId, event.sessionId, event.event, event.positionMs ?? null, event.errorCode ?? null, now()]
      );
    },
    async createPublicRequest(data) {
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
      const { rows } = await pool.query(
        `INSERT INTO public_requests (id, type, email, account_email, message, status, verification_token_hash, verification_expires_at, verified_at, resolution_note, resolved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [record.id, record.type, record.email, record.accountEmail ?? null, record.message ?? '', record.status, record.verificationTokenHash, record.verificationExpiresAt, record.verifiedAt, record.resolutionNote, record.resolvedAt, record.createdAt, record.updatedAt]
      );
      return mapPublicRequest(rows[0]);
    },
    async getPublicRequest(id) {
      const { rows } = await pool.query('SELECT * FROM public_requests WHERE id = $1', [id]);
      return mapPublicRequest(rows[0]);
    },
    async listPublicRequests({ type, status } = {}) {
      const filters = [];
      const values = [];
      if (type) { values.push(type); filters.push(`type = $${values.length}`); }
      if (status) { values.push(status); filters.push(`status = $${values.length}`); }
      const { rows } = await pool.query(`SELECT * FROM public_requests${filters.length ? ` WHERE ${filters.join(' AND ')}` : ''} ORDER BY created_at ASC`, values);
      return rows.map(mapPublicRequest);
    },
    async updatePublicRequest(id, patch) {
      const fields = {
        status: 'status',
        verificationTokenHash: 'verification_token_hash',
        verificationExpiresAt: 'verification_expires_at',
        verifiedAt: 'verified_at',
        resolutionNote: 'resolution_note',
        resolvedAt: 'resolved_at'
      };
      const entries = Object.entries(patch).filter(([key]) => fields[key]);
      if (!entries.length) return this.getPublicRequest(id);
      const values = entries.map(([, value]) => value);
      const sets = entries.map(([key], index) => `${fields[key]} = $${index + 1}`);
      values.push(now(), id);
      const { rows } = await pool.query(`UPDATE public_requests SET ${sets.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length} RETURNING *`, values);
      return mapPublicRequest(rows[0]);
    },
    async overview() {
      const [summary, quality, top] = await Promise.all([
        pool.query(`SELECT COALESCE(SUM(views), 0) AS total_views, COALESCE(SUM(likes), 0) AS total_likes, COUNT(*) FILTER (WHERE status = 'published') AS published FROM content_items`),
        pool.query(`SELECT (SELECT COUNT(*) FROM comments WHERE status = 'pending') AS pending_comments, COUNT(*) FILTER (WHERE event = 'first_frame') AS first_frames, COUNT(*) FILTER (WHERE event = 'buffer_start') AS buffer_starts FROM playback_events`),
        pool.query(`SELECT * FROM content_items WHERE status = 'published' ORDER BY views DESC LIMIT 5`)
      ]);
      return {
        totalViews: Number(summary.rows[0].total_views) + Number(quality.rows[0].first_frames),
        totalLikes: Number(summary.rows[0].total_likes),
        pendingComments: Number(quality.rows[0].pending_comments),
        published: Number(summary.rows[0].published),
        firstFrameEvents: Number(quality.rows[0].first_frames),
        bufferStartEvents: Number(quality.rows[0].buffer_starts),
        topContent: top.rows.map(mapContent)
      };
    },
    async createMedia(data) {
      const record = {
        id: data.id ?? randomUUID(),
        relation: 'asset',
        status: 'available',
        contentId: null,
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
      const { rows } = await pool.query(
        `INSERT INTO media_assets (id, kind, relation, status, content_id, storage_key, file_name, content_type, size_bytes, duration_ms, upload_id, part_size, part_count, metadata, completed_at, queued_at, aborted_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
        [record.id, record.kind, record.relation, record.status, record.contentId, record.storageKey, record.fileName, record.contentType, record.size, record.durationMs, record.uploadId, record.partSize, record.partCount, JSON.stringify(record.metadata ?? {}), record.completedAt, record.queuedAt, record.abortedAt, record.createdAt, record.updatedAt]
      );
      return mapMedia(rows[0]);
    },
    async getMedia(id) {
      const { rows } = await pool.query('SELECT * FROM media_assets WHERE id = $1', [id]);
      return mapMedia(rows[0]);
    },
    async updateMedia(id, patch) {
      const fields = {
        relation: 'relation',
        status: 'status',
        contentId: 'content_id',
        storageKey: 'storage_key',
        fileName: 'file_name',
        contentType: 'content_type',
        size: 'size_bytes',
        durationMs: 'duration_ms',
        uploadId: 'upload_id',
        partSize: 'part_size',
        partCount: 'part_count',
        metadata: 'metadata',
        completedAt: 'completed_at',
        queuedAt: 'queued_at',
        abortedAt: 'aborted_at'
      };
      const entries = Object.entries(patch).filter(([key]) => fields[key]);
      if (!entries.length) return this.getMedia(id);
      const values = entries.map(([key, value]) => key === 'metadata' ? JSON.stringify(value ?? {}) : value);
      const sets = entries.map(([key], index) => `${fields[key]} = $${index + 1}`);
      values.push(now(), id);
      const { rows } = await pool.query(
        `UPDATE media_assets SET ${sets.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length} RETURNING *`,
        values
      );
      return mapMedia(rows[0]);
    },
    async audit(entry) {
      await pool.query(
        `INSERT INTO audit_log (id, at, actor_id, roles, action, entity_type, entity_id, before_state, after_state, request_id, ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [randomUUID(), now(), entry.actorId, JSON.stringify(entry.roles), entry.action, entry.entityType, entry.entityId, JSON.stringify(entry.before ?? null), JSON.stringify(entry.after ?? null), entry.requestId ?? null, entry.ip ?? null]
      );
    },
    async close() { await pool.end(); }
  };
}
