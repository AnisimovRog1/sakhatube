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
  storageKey: row.storage_key,
  fileName: row.file_name,
  contentType: row.content_type,
  size: Number(row.size_bytes),
  createdAt: row.created_at.toISOString()
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
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
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
      storage_key TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
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
    CREATE INDEX IF NOT EXISTS comments_status_idx ON comments(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS playback_events_content_idx ON playback_events(content_id, received_at DESC);
  `);
}

async function seed(pool, seed) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of seed.content) {
      await client.query(
        `INSERT INTO content_items (id, title, kind, genre, synopsis, status, access, episodes, views, likes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [item.id, item.title, item.kind, item.genre, item.synopsis, item.status, item.access, item.episodes, item.views, item.likes, item.createdAt, item.updatedAt]
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
      const item = { id: randomUUID(), views: 0, likes: 0, createdAt: now(), updatedAt: now(), ...data };
      const { rows } = await pool.query(
        `INSERT INTO content_items (id, title, kind, genre, synopsis, status, access, episodes, views, likes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [item.id, item.title, item.kind, item.genre, item.synopsis, item.status, item.access, item.episodes, item.views, item.likes, item.createdAt, item.updatedAt]
      );
      return mapContent(rows[0]);
    },
    async updateContent(id, patch) {
      const fields = {
        title: 'title', kind: 'kind', genre: 'genre', synopsis: 'synopsis', status: 'status', access: 'access', episodes: 'episodes'
      };
      const entries = Object.entries(patch).filter(([key]) => fields[key]);
      if (!entries.length) return this.getContent(id);
      const values = entries.map(([, value]) => value);
      const sets = entries.map(([key], index) => `${fields[key]} = $${index + 1}`);
      values.push(now(), id);
      const { rows } = await pool.query(`UPDATE content_items SET ${sets.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length} RETURNING *`, values);
      return mapContent(rows[0]);
    },
    async listHomeSlots() {
      const { rows } = await pool.query('SELECT c.* FROM home_slots h JOIN content_items c ON c.id = h.content_id ORDER BY h.slot_index ASC');
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
      const record = { id: randomUUID(), createdAt: now(), ...data };
      const { rows } = await pool.query(
        `INSERT INTO media_assets (id, kind, storage_key, file_name, content_type, size_bytes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [record.id, record.kind, record.storageKey, record.fileName, record.contentType, record.size, record.createdAt]
      );
      return mapMedia(rows[0]);
    },
    async getMedia(id) {
      const { rows } = await pool.query('SELECT * FROM media_assets WHERE id = $1', [id]);
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
