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

const mapCommentReport = (row) => row && ({
  id: row.id,
  commentId: row.comment_id,
  reporterId: row.reporter_id,
  reason: row.reason,
  note: row.note,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null
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

const mapViewerAccount = (row) => row && ({
  id: row.id,
  publicId: row.public_id,
  firebaseUid: row.firebase_uid,
  email: row.email,
  username: row.username,
  displayName: row.display_name,
  passwordHash: row.password_hash,
  status: row.status,
  verificationTokenHash: row.verification_token_hash,
  verificationExpiresAt: row.verification_expires_at ? row.verification_expires_at.toISOString() : null,
  emailVerifiedAt: row.email_verified_at ? row.email_verified_at.toISOString() : null,
  lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString()
});

const mapViewerSession = (row) => row && ({
  id: row.id,
  accountId: row.account_id,
  refreshTokenHash: row.refresh_token_hash,
  deviceName: row.device_name,
  expiresAt: row.expires_at.toISOString(),
  revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
  revocationReason: row.revocation_reason,
  rotatedAt: row.rotated_at ? row.rotated_at.toISOString() : null,
  lastUsedAt: row.last_used_at.toISOString(),
  createdAt: row.created_at.toISOString()
});

const mapMediaJob = (row) => row && ({
  id: row.id, sourceAssetId: row.source_asset_id, contentId: row.content_id,
  sourceKey: row.source_key, contentType: row.content_type, sizeBytes: Number(row.size_bytes),
  status: row.status, attempt: row.attempt, maxAttempts: row.max_attempts,
  availableAt: row.available_at.toISOString(), workerId: row.worker_id,
  leaseToken: row.lease_token, leaseExpiresAt: row.lease_expires_at ? row.lease_expires_at.toISOString() : null,
  startedAt: row.started_at ? row.started_at.toISOString() : null,
  completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  lastErrorCode: row.last_error_code, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()
});

const mapBanner = (row) => row && ({
  id: row.id, contentId: row.content_id, eyebrow: row.eyebrow, title: row.title,
  description: row.description, cta: row.cta, tone: row.tone, active: row.active,
  mediaId: row.media_id, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()
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
    CREATE TABLE IF NOT EXISTS comment_reports (
      id UUID PRIMARY KEY,
      comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      reporter_id UUID NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('spam', 'abuse', 'hate', 'sexual', 'copyright', 'other')),
      note TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
      created_at TIMESTAMPTZ NOT NULL,
      resolved_at TIMESTAMPTZ,
      CONSTRAINT comment_reports_one_per_viewer UNIQUE (comment_id, reporter_id)
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
    CREATE TABLE IF NOT EXISTS viewer_accounts (
      id UUID PRIMARY KEY,
      public_id TEXT,
      firebase_uid TEXT,
      email TEXT NOT NULL,
      username TEXT,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'active', 'disabled', 'deleted')),
      verification_token_hash TEXT,
      verification_expires_at TIMESTAMPTZ,
      email_verified_at TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT viewer_accounts_email_lowercase CHECK (email = lower(email)),
      CONSTRAINT viewer_accounts_email_unique UNIQUE (email)
    );
    ALTER TABLE viewer_accounts DROP CONSTRAINT IF EXISTS viewer_accounts_status_check;
    ALTER TABLE viewer_accounts ADD CONSTRAINT viewer_accounts_status_check CHECK (status IN ('pending_verification', 'active', 'disabled', 'deleted'));
    ALTER TABLE viewer_accounts ADD COLUMN IF NOT EXISTS verification_token_hash TEXT;
    ALTER TABLE viewer_accounts ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;
    ALTER TABLE viewer_accounts ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
    ALTER TABLE viewer_accounts ADD COLUMN IF NOT EXISTS public_id TEXT;
    ALTER TABLE viewer_accounts ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE viewer_accounts ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
    UPDATE viewer_accounts SET public_id = 'ST-' || upper(substr(replace(id::text, '-', ''), 1, 12)) WHERE public_id IS NULL;
    UPDATE viewer_accounts SET username = 'viewer-' || lower(substr(replace(id::text, '-', ''), 1, 10)) WHERE username IS NULL;
    ALTER TABLE viewer_accounts ALTER COLUMN public_id SET NOT NULL;
    ALTER TABLE viewer_accounts ALTER COLUMN username SET NOT NULL;
    ALTER TABLE viewer_accounts DROP CONSTRAINT IF EXISTS viewer_accounts_public_id_unique;
    ALTER TABLE viewer_accounts ADD CONSTRAINT viewer_accounts_public_id_unique UNIQUE (public_id);
    ALTER TABLE viewer_accounts DROP CONSTRAINT IF EXISTS viewer_accounts_username_unique;
    ALTER TABLE viewer_accounts ADD CONSTRAINT viewer_accounts_username_unique UNIQUE (username);
    ALTER TABLE viewer_accounts DROP CONSTRAINT IF EXISTS viewer_accounts_username_lowercase;
    ALTER TABLE viewer_accounts ADD CONSTRAINT viewer_accounts_username_lowercase CHECK (username = lower(username));
    ALTER TABLE viewer_accounts DROP CONSTRAINT IF EXISTS viewer_accounts_firebase_uid_unique;
    ALTER TABLE viewer_accounts ADD CONSTRAINT viewer_accounts_firebase_uid_unique UNIQUE (firebase_uid);
    CREATE TABLE IF NOT EXISTS viewer_sessions (
      id UUID PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES viewer_accounts(id) ON DELETE CASCADE,
      refresh_token_hash TEXT NOT NULL UNIQUE,
      device_name TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      revocation_reason TEXT,
      rotated_at TIMESTAMPTZ,
      last_used_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS viewer_blocks (
      id UUID PRIMARY KEY,
      blocker_id UUID NOT NULL REFERENCES viewer_accounts(id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES viewer_accounts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT viewer_blocks_not_self CHECK (blocker_id <> blocked_id),
      CONSTRAINT viewer_blocks_one_per_pair UNIQUE (blocker_id, blocked_id)
    );
    CREATE TABLE IF NOT EXISTS media_transcode_jobs (
      id UUID PRIMARY KEY,
      source_asset_id UUID NOT NULL UNIQUE REFERENCES media_assets(id) ON DELETE CASCADE,
      content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      source_key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'retry_wait', 'succeeded', 'dead')),
      attempt INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
      available_at TIMESTAMPTZ NOT NULL,
      worker_id TEXT,
      lease_token TEXT,
      lease_expires_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      last_error_code TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS home_banners (
      id TEXT PRIMARY KEY,
      banner_index INTEGER NOT NULL UNIQUE,
      content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      eyebrow TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cta TEXT NOT NULL,
      tone TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT FALSE,
      media_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS comments_status_idx ON comments(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS comment_reports_status_idx ON comment_reports(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS viewer_blocks_blocker_idx ON viewer_blocks(blocker_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS playback_events_content_idx ON playback_events(content_id, received_at DESC);
    CREATE INDEX IF NOT EXISTS content_scheduled_idx ON content_items(status, scheduled_at) WHERE status = 'scheduled';
    CREATE INDEX IF NOT EXISTS media_assets_content_idx ON media_assets(content_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS media_assets_status_idx ON media_assets(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS public_requests_queue_idx ON public_requests(type, status, created_at ASC);
    CREATE INDEX IF NOT EXISTS viewer_accounts_status_idx ON viewer_accounts(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS viewer_sessions_account_idx ON viewer_sessions(account_id, revoked_at, expires_at DESC);
    CREATE INDEX IF NOT EXISTS media_transcode_jobs_claim_idx ON media_transcode_jobs(status, available_at, created_at);
    CREATE INDEX IF NOT EXISTS home_banners_public_idx ON home_banners(active, banner_index) WHERE active = TRUE;
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
    for (const [bannerIndex, banner] of (seed.banners ?? []).entries()) {
      await client.query(
        `INSERT INTO home_banners (id, banner_index, content_id, eyebrow, title, description, cta, tone, active, media_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
        [banner.id, bannerIndex, banner.contentId, banner.eyebrow, banner.title, banner.description, banner.cta, banner.tone, banner.active, banner.mediaId ?? null, banner.createdAt ?? now(), banner.updatedAt ?? now()]
      );
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
    async listBanners() {
      const { rows } = await pool.query('SELECT * FROM home_banners ORDER BY banner_index ASC');
      return rows.map(mapBanner);
    },
    async listPublishedBanners() {
      const { rows } = await pool.query('SELECT * FROM home_banners WHERE active = TRUE ORDER BY banner_index ASC');
      return rows.map(mapBanner);
    },
    async getBanner(id) {
      const { rows } = await pool.query('SELECT * FROM home_banners WHERE id = $1', [id]);
      return mapBanner(rows[0]);
    },
    async createBanner(data) {
      const { rows: positionRows } = await pool.query('SELECT COALESCE(MAX(banner_index), -1) + 1 AS next FROM home_banners');
      const item = { id: randomUUID(), createdAt: now(), updatedAt: now(), ...data };
      const { rows } = await pool.query(
        `INSERT INTO home_banners (id, banner_index, content_id, eyebrow, title, description, cta, tone, active, media_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [item.id, Number(positionRows[0].next), item.contentId, item.eyebrow, item.title, item.description, item.cta, item.tone, item.active, item.mediaId, item.createdAt, item.updatedAt]
      );
      return mapBanner(rows[0]);
    },
    async updateBanner(id, patch) {
      const fields = { contentId: 'content_id', eyebrow: 'eyebrow', title: 'title', description: 'description', cta: 'cta', tone: 'tone', active: 'active', mediaId: 'media_id' };
      const entries = Object.entries(patch).filter(([key]) => fields[key]);
      if (!entries.length) return this.getBanner(id);
      const values = entries.map(([, value]) => value);
      const sets = entries.map(([key], index) => `${fields[key]} = $${index + 1}`);
      values.push(now(), id);
      const { rows } = await pool.query(`UPDATE home_banners SET ${sets.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length} RETURNING *`, values);
      return mapBanner(rows[0]);
    },
    async deleteBanner(id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('DELETE FROM home_banners WHERE id = $1 RETURNING *', [id]);
        if (!rows[0]) { await client.query('COMMIT'); return null; }
        await client.query('WITH ordered AS (SELECT id, ROW_NUMBER() OVER (ORDER BY banner_index) - 1 AS next_index FROM home_banners) UPDATE home_banners b SET banner_index = ordered.next_index FROM ordered WHERE b.id = ordered.id');
        await client.query('COMMIT');
        return mapBanner(rows[0]);
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async replaceBanners(items) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Offset avoids a transient unique-index collision while positions swap.
        await client.query('UPDATE home_banners SET banner_index = banner_index + 10000');
        for (const [index, item] of items.entries()) await client.query('UPDATE home_banners SET banner_index = $1, updated_at = $2 WHERE id = $3', [index, now(), item.id]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      return this.listBanners();
    },
    async listComments(status) {
      const { rows } = await pool.query(`SELECT * FROM comments ${status ? 'WHERE status = $1' : ''} ORDER BY updated_at DESC`, status ? [status] : []);
      return rows.map(mapComment);
    },
    async getComment(id) {
      const { rows } = await pool.query('SELECT * FROM comments WHERE id = $1', [id]);
      return mapComment(rows[0]);
    },
    async listPublicComments(contentId, { limit = 50, viewerId = null } = {}) {
      const { rows } = await pool.query(
        `SELECT c.* FROM comments c
         WHERE c.content_id = $1 AND c.status = 'approved'
           AND NOT EXISTS (
             SELECT 1 FROM viewer_blocks b
             WHERE b.blocker_id = $2::uuid AND b.blocked_id::text = c.author_id
           )
         ORDER BY c.created_at DESC LIMIT $3`,
        [contentId, viewerId, Math.max(1, Math.min(100, Number(limit) || 50))]
      );
      return rows.map(mapComment);
    },
    async createComment(data) {
      const record = { id: randomUUID(), status: 'pending', moderationNote: null, createdAt: now(), updatedAt: now(), ...data };
      const { rows } = await pool.query(
        `INSERT INTO comments (id, content_id, author_id, author_name, body, status, moderation_note, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [record.id, record.contentId, record.authorId, record.authorName, record.text, record.status, record.moderationNote, record.createdAt, record.updatedAt]
      );
      return mapComment(rows[0]);
    },
    async createCommentReport(data) {
      const record = { id: randomUUID(), status: 'open', createdAt: now(), ...data };
      const { rows } = await pool.query(
        `INSERT INTO comment_reports (id, comment_id, reporter_id, reason, note, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [record.id, record.commentId, record.reporterId, record.reason, record.note ?? null, record.status, record.createdAt]
      );
      return mapCommentReport(rows[0]);
    },
    async listCommentReports({ status } = {}) {
      const { rows } = await pool.query(
        `SELECT * FROM comment_reports ${status ? 'WHERE status = $1' : ''} ORDER BY created_at DESC`,
        status ? [status] : []
      );
      return rows.map(mapCommentReport);
    },
    async resolveCommentReports(commentId) {
      const { rowCount } = await pool.query(
        "UPDATE comment_reports SET status = 'resolved', resolved_at = $1 WHERE comment_id = $2 AND status = 'open'",
        [now(), commentId]
      );
      return rowCount;
    },
    async updateComment(id, status, moderationNote) {
      const { rows } = await pool.query('UPDATE comments SET status = $1, moderation_note = $2, updated_at = $3 WHERE id = $4 RETURNING *', [status, moderationNote ?? null, now(), id]);
      return mapComment(rows[0]);
    },
    async createViewerBlock({ blockerId, blockedId }) {
      const record = { id: randomUUID(), blockerId, blockedId, createdAt: now() };
      const { rows } = await pool.query(
        'INSERT INTO viewer_blocks (id, blocker_id, blocked_id, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [record.id, record.blockerId, record.blockedId, record.createdAt]
      );
      return { id: rows[0].id, blockerId: rows[0].blocker_id, blockedId: rows[0].blocked_id, createdAt: rows[0].created_at.toISOString() };
    },
    async listViewerBlocks(blockerId) {
      const { rows } = await pool.query(
        `SELECT b.id, b.blocked_id, b.created_at, a.public_id, a.username, a.display_name
         FROM viewer_blocks b JOIN viewer_accounts a ON a.id = b.blocked_id
         WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`,
        [blockerId]
      );
      return rows.map((row) => ({
        id: row.id, blockedId: row.blocked_id, createdAt: row.created_at.toISOString(),
        account: { id: row.public_id, username: row.username, displayName: row.display_name }
      }));
    },
    async deleteViewerBlock(id, blockerId) {
      const { rows } = await pool.query('DELETE FROM viewer_blocks WHERE id = $1 AND blocker_id = $2 RETURNING *', [id, blockerId]);
      if (!rows[0]) return null;
      return { id: rows[0].id, blockerId: rows[0].blocker_id, blockedId: rows[0].blocked_id, createdAt: rows[0].created_at.toISOString() };
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
    async createViewerAccount(data) {
      const record = {
        id: randomUUID(),
        status: 'active',
        lastLoginAt: null,
        createdAt: now(),
        updatedAt: now(),
        ...data
      };
      const { rows } = await pool.query(
        `INSERT INTO viewer_accounts (id, public_id, firebase_uid, email, username, display_name, password_hash, status, verification_token_hash, verification_expires_at, email_verified_at, last_login_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [record.id, record.publicId, record.firebaseUid ?? null, record.email, record.username, record.displayName, record.passwordHash, record.status, record.verificationTokenHash, record.verificationExpiresAt, record.emailVerifiedAt, record.lastLoginAt, record.createdAt, record.updatedAt]
      );
      return mapViewerAccount(rows[0]);
    },
    async getViewerAccount(id) {
      const { rows } = await pool.query('SELECT * FROM viewer_accounts WHERE id = $1', [id]);
      return mapViewerAccount(rows[0]);
    },
    async getViewerAccountByEmail(email) {
      const { rows } = await pool.query('SELECT * FROM viewer_accounts WHERE email = $1', [email]);
      return mapViewerAccount(rows[0]);
    },
    async getViewerAccountByUsername(username) {
      const { rows } = await pool.query('SELECT * FROM viewer_accounts WHERE username = $1', [username]);
      return mapViewerAccount(rows[0]);
    },
    async getViewerAccountByFirebaseUid(firebaseUid) {
      const { rows } = await pool.query('SELECT * FROM viewer_accounts WHERE firebase_uid = $1', [firebaseUid]);
      return mapViewerAccount(rows[0]);
    },
    async updateViewerAccount(id, patch) {
      const fields = {
        displayName: 'display_name',
        firebaseUid: 'firebase_uid',
        passwordHash: 'password_hash',
        status: 'status',
        verificationTokenHash: 'verification_token_hash',
        verificationExpiresAt: 'verification_expires_at',
        emailVerifiedAt: 'email_verified_at',
        lastLoginAt: 'last_login_at'
      };
      const entries = Object.entries(patch).filter(([key]) => fields[key]);
      if (!entries.length) return this.getViewerAccount(id);
      const values = entries.map(([, value]) => value);
      const sets = entries.map(([key], index) => `${fields[key]} = $${index + 1}`);
      values.push(now(), id);
      const { rows } = await pool.query(`UPDATE viewer_accounts SET ${sets.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length} RETURNING *`, values);
      return mapViewerAccount(rows[0]);
    },
    async deleteViewerAccountData(id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: accountRows } = await client.query('SELECT * FROM viewer_accounts WHERE id = $1 FOR UPDATE', [id]);
        const account = mapViewerAccount(accountRows[0]);
        if (!account) { await client.query('COMMIT'); return null; }
        const deletedAt = now();
        const deletedAlias = id.replace(/-/g, '').slice(0, 20);
        const revoked = await client.query(
          "UPDATE viewer_sessions SET revoked_at = $1, revocation_reason = 'account_deleted', last_used_at = $1 WHERE account_id = $2 AND revoked_at IS NULL",
          [deletedAt, id]
        );
        const removedReports = await client.query('DELETE FROM comment_reports WHERE reporter_id = $1', [id]);
        const removedComments = await client.query(
          "UPDATE comments SET author_id = 'deleted-account', author_name = 'Удалённый пользователь', body = '', status = 'deleted', moderation_note = 'Удалено вместе с аккаунтом', updated_at = $1 WHERE author_id = $2",
          [deletedAt, id]
        );
        await client.query('UPDATE playback_events SET viewer_id = NULL WHERE viewer_id = $1', [id]);
        const { rows } = await client.query(
          `UPDATE viewer_accounts
             SET public_id = $1, firebase_uid = NULL, email = $2, username = $3,
                 display_name = 'Удалённый пользователь', password_hash = 'deleted', status = 'deleted',
                 verification_token_hash = NULL, verification_expires_at = NULL, email_verified_at = NULL,
                 last_login_at = NULL, updated_at = $4
           WHERE id = $5 RETURNING *`,
          [`DELETED-${deletedAlias}`, `deleted+${deletedAlias}@deleted.invalid`, `deleted-${deletedAlias}`, deletedAt, id]
        );
        await client.query('COMMIT');
        return { account: mapViewerAccount(rows[0]), deletedAt, revokedSessions: revoked.rowCount, deletedComments: removedComments.rowCount, removedReports: removedReports.rowCount };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async createViewerSession(data) {
      const record = {
        id: randomUUID(),
        deviceName: null,
        revokedAt: null,
        revocationReason: null,
        rotatedAt: null,
        createdAt: now(),
        lastUsedAt: now(),
        ...data
      };
      const { rows } = await pool.query(
        `INSERT INTO viewer_sessions (id, account_id, refresh_token_hash, device_name, expires_at, revoked_at, revocation_reason, rotated_at, last_used_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [record.id, record.accountId, record.refreshTokenHash, record.deviceName, record.expiresAt, record.revokedAt, record.revocationReason, record.rotatedAt, record.lastUsedAt, record.createdAt]
      );
      return mapViewerSession(rows[0]);
    },
    async getViewerSession(id) {
      const { rows } = await pool.query('SELECT * FROM viewer_sessions WHERE id = $1', [id]);
      return mapViewerSession(rows[0]);
    },
    async consumeViewerSession(tokenHash, replacement) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT * FROM viewer_sessions WHERE refresh_token_hash = $1 FOR UPDATE', [tokenHash]);
        const current = mapViewerSession(rows[0]);
        if (!current) { await client.query('COMMIT'); return { status: 'invalid' }; }
        if (current.revokedAt || new Date(current.expiresAt).getTime() <= Date.now()) { await client.query('COMMIT'); return { status: 'reused', accountId: current.accountId }; }
        const timestamp = now();
        await client.query('UPDATE viewer_sessions SET revoked_at = $1, revocation_reason = $2, rotated_at = $1, last_used_at = $1 WHERE id = $3', [timestamp, 'rotated', current.id]);
        const record = { id: randomUUID(), accountId: current.accountId, deviceName: null, createdAt: timestamp, lastUsedAt: timestamp, ...replacement };
        const inserted = await client.query(
          `INSERT INTO viewer_sessions (id, account_id, refresh_token_hash, device_name, expires_at, last_used_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [record.id, record.accountId, record.refreshTokenHash, record.deviceName, record.expiresAt, record.lastUsedAt, record.createdAt]
        );
        await client.query('COMMIT');
        return { status: 'rotated', session: mapViewerSession(inserted.rows[0]) };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async revokeViewerSession(id, reason = 'logout') {
      const { rows } = await pool.query(
        'UPDATE viewer_sessions SET revoked_at = $1, revocation_reason = $2, last_used_at = $1 WHERE id = $3 AND revoked_at IS NULL RETURNING *',
        [now(), reason, id]
      );
      return mapViewerSession(rows[0]);
    },
    async revokeViewerSessionsForAccount(accountId, reason = 'logout_all') {
      const { rowCount } = await pool.query(
        'UPDATE viewer_sessions SET revoked_at = $1, revocation_reason = $2, last_used_at = $1 WHERE account_id = $3 AND revoked_at IS NULL',
        [now(), reason, accountId]
      );
      return rowCount;
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
    async listMediaForContent(contentId) {
      const { rows } = await pool.query(
        'SELECT * FROM media_assets WHERE content_id = $1 ORDER BY created_at DESC',
        [contentId]
      );
      return rows.map(mapMedia);
    },
    async listMedia({ limit = 100 } = {}) {
      const { rows } = await pool.query(
        'SELECT * FROM media_assets ORDER BY created_at DESC LIMIT $1',
        [Math.max(1, Math.min(200, Number(limit) || 100))]
      );
      return rows.map(mapMedia);
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
    async createMediaJob(data) {
      const record = { id: randomUUID(), status: 'queued', attempt: 0, maxAttempts: 3, availableAt: now(), createdAt: now(), updatedAt: now(), ...data };
      const { rows } = await pool.query(
        `INSERT INTO media_transcode_jobs (id, source_asset_id, content_id, source_key, content_type, size_bytes, status, attempt, max_attempts, available_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (source_asset_id) DO UPDATE SET source_asset_id = EXCLUDED.source_asset_id
         RETURNING *`,
        [record.id, record.sourceAssetId, record.contentId, record.sourceKey, record.contentType, record.sizeBytes, record.status, record.attempt, record.maxAttempts, record.availableAt, record.createdAt, record.updatedAt]
      );
      return mapMediaJob(rows[0]);
    },
    async listMediaJobs({ sourceAssetIds } = {}) {
      const { rows } = sourceAssetIds?.length
        ? await pool.query('SELECT * FROM media_transcode_jobs WHERE source_asset_id = ANY($1::uuid[]) ORDER BY created_at DESC', [sourceAssetIds])
        : await pool.query('SELECT * FROM media_transcode_jobs ORDER BY created_at DESC');
      return rows.map(mapMediaJob);
    },
    async getMediaJob(id) {
      const { rows } = await pool.query('SELECT * FROM media_transcode_jobs WHERE id = $1', [id]);
      return mapMediaJob(rows[0]);
    },
    async claimMediaJob({ workerId, leaseToken, leaseMs = 900000, at = now() }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`UPDATE media_transcode_jobs SET status = 'dead', lease_token = NULL, lease_expires_at = NULL, completed_at = $1, updated_at = $1 WHERE status = 'running' AND lease_expires_at <= $1 AND attempt >= max_attempts`, [at]);
        const { rows } = await client.query(
          `SELECT * FROM media_transcode_jobs
           WHERE ((status IN ('queued','retry_wait') AND available_at <= $1)
              OR (status = 'running' AND lease_expires_at <= $1)) AND attempt < max_attempts
           ORDER BY available_at ASC, created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`, [at]
        );
        if (!rows[0]) { await client.query('COMMIT'); return null; }
        const expiresAt = new Date(new Date(at).getTime() + leaseMs).toISOString();
        const updated = await client.query(`UPDATE media_transcode_jobs SET status = 'running', worker_id = $1, attempt = attempt + 1, lease_token = $2, lease_expires_at = $3, started_at = COALESCE(started_at, $4), updated_at = $4 WHERE id = $5 RETURNING *`, [workerId, leaseToken, expiresAt, at, rows[0].id]);
        await client.query('COMMIT');
        return mapMediaJob(updated.rows[0]);
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async settleMediaJob(id, { leaseToken, outcome, errorCode = null, retryAt = null, at = now() }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const selected = await client.query('SELECT * FROM media_transcode_jobs WHERE id = $1 FOR UPDATE', [id]);
        const current = mapMediaJob(selected.rows[0]);
        if (!current) { await client.query('COMMIT'); return { status: 'not_found' }; }
        if (current.status === 'succeeded' && outcome === 'succeeded') { await client.query('COMMIT'); return { status: 'idempotent', job: current }; }
        if (current.status !== 'running' || current.leaseToken !== leaseToken || new Date(current.leaseExpiresAt).getTime() <= new Date(at).getTime()) { await client.query('COMMIT'); return { status: 'lease_lost' }; }
        const terminal = outcome === 'succeeded' || outcome === 'permanent_failure' || (outcome === 'retryable_failure' && current.attempt >= current.maxAttempts);
        const status = outcome === 'succeeded' ? 'succeeded' : terminal ? 'dead' : 'retry_wait';
        const updated = await client.query(`UPDATE media_transcode_jobs SET status = $1, lease_token = NULL, lease_expires_at = NULL, completed_at = $2, available_at = $3, last_error_code = $4, updated_at = $5 WHERE id = $6 RETURNING *`, [status, terminal ? at : null, retryAt ?? at, errorCode, at, id]);
        await client.query('COMMIT');
        return { status: 'updated', job: mapMediaJob(updated.rows[0]) };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
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
