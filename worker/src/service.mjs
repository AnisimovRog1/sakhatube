import { processJob } from './runner.mjs';
import { JobError } from './contract.mjs';
import { createAdapter } from './adapter.mjs';
import { createWorkerStorage } from './storage.mjs';
import { createWorkerStore } from './store.mjs';
import { createApiClient } from './api-client.mjs';

// Retrying these will never succeed: the source file itself is bad
// (malformed job, wrong MIME, no video stream, impossible dimensions/size).
// Everything else (network blip, ffmpeg crash, transient S3 error) is
// retried by the server's own lease-expiry/attempt bookkeeping.
const PERMANENT_CODES = new Set([
  'INVALID_JOB', 'INVALID_SOURCE_KEY', 'UNSUPPORTED_MEDIA_TYPE', 'INVALID_SIZE',
  'PROBE_NO_VIDEO', 'PROBE_DURATION', 'PROBE_DIMENSIONS', 'FFPROBE_INVALID_JSON',
  'SOURCE_SIZE_MISMATCH', 'PRIVATE_SOURCE_REQUIRED'
]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} обязателен для запуска воркера`);
  return value;
}

function loadConfig() {
  return {
    apiBaseUrl: requireEnv('SAKHATUBE_API_URL').replace(/\/$/, ''),
    workerToken: requireEnv('MEDIA_WORKER_TOKEN'),
    workerId: process.env.WORKER_ID || `worker-${process.pid}`,
    databaseUrl: requireEnv('DATABASE_URL'),
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 8000),
    s3: {
      endpoint: requireEnv('S3_ENDPOINT'),
      accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
      bucket: requireEnv('S3_BUCKET'),
      region: process.env.S3_REGION || 'auto'
    }
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runWorkerLoop({ config, api, adapter, shouldStop }) {
  while (!shouldStop()) {
    let job;
    try {
      job = await api.claim(config.workerId);
    } catch (error) {
      console.error('claim failed, backing off:', error.message);
      await sleep(config.pollIntervalMs);
      continue;
    }
    if (!job) {
      await sleep(config.pollIntervalMs);
      continue;
    }
    console.log(`claimed job ${job.jobId} for content ${job.contentId}`);
    try {
      const { rendition } = await processJob(job, adapter);
      await api.settle(job.jobId, { leaseToken: job.leaseToken, outcome: 'succeeded', renditionAssetId: rendition.id });
      console.log(`job ${job.jobId} succeeded -> rendition ${rendition.id}`);
    } catch (error) {
      const code = error instanceof JobError ? error.code : 'WORKER_INTERNAL_ERROR';
      const permanent = error instanceof JobError && PERMANENT_CODES.has(error.code);
      console.error(`job ${job.jobId} failed [${code}]:`, error.message);
      try {
        await api.settle(job.jobId, {
          leaseToken: job.leaseToken,
          outcome: permanent ? 'permanent_failure' : 'retryable_failure',
          errorCode: code,
          ...(permanent ? {} : { retryAfterSeconds: 60 })
        });
      } catch (settleError) {
        console.error(`could not settle job ${job.jobId} after failure:`, settleError.message);
      }
    } finally {
      // Covers the failure paths that never reach transcode() — e.g. a
      // corrupt/unsupported upload rejected by ffprobe validation — where the
      // downloaded source would otherwise never get deleted.
      await adapter.cleanupPending?.();
    }
  }
}

async function main() {
  const config = loadConfig();
  const store = await createWorkerStore(config.databaseUrl);
  const storage = createWorkerStorage(config.s3);
  const adapter = createAdapter({ storage, store });
  const api = createApiClient({ baseUrl: config.apiBaseUrl, token: config.workerToken });

  let shuttingDown = false;
  process.on('SIGTERM', () => { shuttingDown = true; });
  process.on('SIGINT', () => { shuttingDown = true; });

  console.log(`sakhatube media worker started as ${config.workerId}, polling ${config.apiBaseUrl}`);
  await runWorkerLoop({ config, api, adapter, shouldStop: () => shuttingDown });
  await store.close();
  console.log('sakhatube media worker stopped');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('worker crashed:', error);
    process.exitCode = 1;
  });
}
