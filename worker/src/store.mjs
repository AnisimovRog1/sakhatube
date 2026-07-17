import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const now = () => new Date().toISOString();

// Deliberately minimal and self-contained: the worker is built and deployed
// from this directory alone (see ../Dockerfile), so it cannot import
// server/postgres-store.js. It only ever writes media_assets rows the API
// already created the table for — it never runs migrations, and the column
// mapping below must stay in sync with mapMedia/createMedia/updateMedia in
// server/postgres-store.js.
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
  metadata: row.metadata ?? {},
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at ? row.updated_at.toISOString() : row.created_at.toISOString()
});

export async function createWorkerStore(connectionString) {
  const pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  await pool.query('SELECT 1');

  return {
    async createMedia(data) {
      const record = {
        id: data.id ?? randomUUID(),
        contentId: null,
        durationMs: null,
        metadata: {},
        createdAt: now(),
        updatedAt: now(),
        ...data
      };
      const { rows } = await pool.query(
        `INSERT INTO media_assets (id, kind, relation, status, content_id, storage_key, file_name, content_type, size_bytes, duration_ms, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [record.id, record.kind, record.relation, record.status, record.contentId, record.storageKey, record.fileName, record.contentType, record.size, record.durationMs, JSON.stringify(record.metadata ?? {}), record.createdAt, record.updatedAt]
      );
      return mapMedia(rows[0]);
    },
    async updateMedia(id, patch) {
      const fields = { status: 'status', durationMs: 'duration_ms', metadata: 'metadata' };
      const entries = Object.entries(patch).filter(([key]) => fields[key]);
      if (!entries.length) {
        const { rows } = await pool.query('SELECT * FROM media_assets WHERE id = $1', [id]);
        return mapMedia(rows[0]);
      }
      const values = entries.map(([key, value]) => key === 'metadata' ? JSON.stringify(value ?? {}) : value);
      const sets = entries.map(([key], index) => `${fields[key]} = $${index + 1}`);
      values.push(now(), id);
      const { rows } = await pool.query(
        `UPDATE media_assets SET ${sets.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length} RETURNING *`,
        values
      );
      return mapMedia(rows[0]);
    },
    async close() {
      await pool.end();
    }
  };
}
