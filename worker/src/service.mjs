import { processJob } from './runner.mjs';
import { JobError } from './contract.mjs';
import { createAdapter } from './adapter.mjs';
import { createWorkerStorage } from './storage.mjs';
import { createWorkerStore } from './store.mjs';
import { createApiClient } from './api-client.mjs';

// Retrying these will never succeed: the source file itself is bad
// (malformed job, wrong MIME, no video stream, impossible dimensions/size),
// or the worker's own wiring is broken (WORKER_CONFIG -- a missing adapter
// method is identical on every retry, so retrying just retry-storms every
// job the misconfigured worker touches). FFPROBE_FAILED (ffprobe exited
// non-zero against the downloaded source) is permanent for the same reason
// as PROBE_NO_VIDEO/PROBE_DIMENSIONS -- it means the source is unreadable,
// not that something transient happened.
// FFPROBE_INVALID_JSON is deliberately NOT permanent: ffprobe exiting 0 but
// producing stdout that doesn't parse as JSON is a rarer, less clearly
// source-fault anomaly than a nonzero exit code, and worth one retry.
// Everything else (network blip, ffmpeg crash, transient S3 error) is
// retried by the server's own lease-expiry/attempt bookkeeping.
const PERMANENT_CODES = new Set([
  'INVALID_JOB', 'INVALID_SOURCE_KEY', 'UNSUPPORTED_MEDIA_TYPE', 'INVALID_SIZE',
  'PROBE_NO_VIDEO', 'PROBE_DURATION', 'PROBE_DIMENSIONS', 'FFPROBE_FAILED',
  'SOURCE_SIZE_MISMATCH', 'PRIVATE_SOURCE_REQUIRED', 'WORKER_CONFIG'
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
    // A third of the server's 15-minute lease window (server/app.js's
    // mediaJobLeaseMs) -- leaves two renewal attempts of margin before the
    // lease actually expires if one renew call fails transiently.
    leaseRenewIntervalMs: Number(process.env.WORKER_LEASE_RENEW_INTERVAL_MS || 5 * 60 * 1000),
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
    let rendition;
    // A transcode can legitimately outlast a single lease window (large
    // source, several sequential renditions) -- without this, claimMediaJob's
    // own eligibility check would make the same job claimable by a second
    // worker while this one is still actively working it. Runs only for the
    // duration of processJob, not the (fast) settle call after it.
    const renewTimer = setInterval(() => {
      api.renew(job.jobId, job.leaseToken).catch((error) => {
        console.error(`could not renew lease for job ${job.jobId} (will let the lease run out if this keeps failing):`, error.message);
      });
    }, config.leaseRenewIntervalMs);
    try {
      ({ rendition } = await processJob(job, adapter));
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
      // error.plan is only set once runner.mjs has actually created a
      // rendition plan (see runner.mjs) -- i.e. transcode() may have already
      // uploaded some renditions/segments under that attempt's prefix before
      // this failed. Without this, every failed-partway or timed-out-lease
      // retry left those objects in the bucket forever with nothing to
      // reclaim them.
      if (error.plan) await adapter.cleanupPrefix?.(error.plan.prefix);
      await adapter.cleanupPending?.();
      clearInterval(renewTimer);
      continue;
    }
    // processJob already succeeded here -- a settle failure past this point
    // (e.g. a transient network blip on the settle call itself) must never
    // fall into the failure path above and misreport a genuinely successful
    // transcode as retryable_failure, which would discard the completed
    // rendition and redo the work from scratch for no reason. Left to expire
    // and be reclaimed instead. Lease renewal (above) keeps that expiry from
    // happening prematurely mid-transcode; the remaining gap is the worker
    // writing createMedia/markSource directly rather than that being
    // transactional with settle on the server -- a real duplicate-processing
    // window only if settle itself keeps failing for the full lease window,
    // not the everyday case this fix targets.
    clearInterval(renewTimer);
    try {
      await api.settle(job.jobId, { leaseToken: job.leaseToken, outcome: 'succeeded', renditionAssetId: rendition.id });
      console.log(`job ${job.jobId} succeeded -> rendition ${rendition.id}`);
    } catch (settleError) {
      console.error(`job ${job.jobId} succeeded but could not settle (will retry on lease expiry):`, settleError.message);
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
