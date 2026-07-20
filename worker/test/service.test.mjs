import test from 'node:test';
import assert from 'node:assert/strict';
import { runWorkerLoop } from '../src/service.mjs';

const baseJob = {
  jobId: '11111111-1111-4111-8111-111111111111',
  sourceAssetId: '22222222-2222-4222-8222-222222222222',
  contentId: '33333333-3333-4333-8333-333333333333',
  sourceKey: 'incoming/2026-07-16/22222222-2222-4222-8222-222222222222/source.mp4',
  contentType: 'video/mp4',
  sizeBytes: 10,
  leaseToken: 'lease-token'
};

const workingProbe = { format: { duration: '4' }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 640, height: 360 }, { codec_type: 'audio' }] };

function fakeApi(jobs) {
  const queue = [...jobs];
  const settleCalls = [];
  return {
    settleCalls,
    async claim() { return queue.shift() ?? null; },
    async settle(jobId, payload) { settleCalls.push({ jobId, payload }); return { job: { status: payload.outcome } }; }
  };
}

function stopAfter(times) {
  let count = 0;
  return () => (count++ >= times);
}

test('a fully successful job is settled with the created rendition id', async () => {
  const api = fakeApi([baseJob]);
  const adapter = {
    getSource: async () => ({ localPath: '/tmp/x', sizeBytes: 10, isPublic: false }),
    run: async () => ({ exitCode: 0, stdout: JSON.stringify(workingProbe) }),
    transcode: async () => {},
    verifyOutput: async () => true,
    createMedia: async (asset) => ({ ...asset, id: 'rendition-1' }),
    markSource: async () => {}
  };
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1 }, api, adapter, shouldStop: stopAfter(1) });
  assert.equal(api.settleCalls.length, 1);
  assert.equal(api.settleCalls[0].payload.outcome, 'succeeded');
  assert.equal(api.settleCalls[0].payload.renditionAssetId, 'rendition-1');
});

test('the lease is renewed periodically while a slow transcode is still running, and renewal stops once it settles', async () => {
  const api = fakeApi([baseJob]);
  const renewCalls = [];
  api.renew = async (jobId, leaseToken) => { renewCalls.push({ jobId, leaseToken }); return new Date(Date.now() + 900_000).toISOString(); };
  const adapter = {
    getSource: async () => ({ localPath: '/tmp/x', sizeBytes: 10, isPublic: false }),
    run: async () => ({ exitCode: 0, stdout: JSON.stringify(workingProbe) }),
    // Slow enough that a 10ms renewal interval gets at least one real chance
    // to fire before processJob resolves.
    transcode: async () => new Promise((resolve) => setTimeout(resolve, 45)),
    verifyOutput: async () => true,
    createMedia: async (asset) => ({ ...asset, id: 'rendition-1' }),
    markSource: async () => {},
    cleanupPending: async () => {}
  };
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1, leaseRenewIntervalMs: 10 }, api, adapter, shouldStop: stopAfter(1) });
  assert.ok(renewCalls.length >= 1, `expected at least one renew call, got ${renewCalls.length}`);
  assert.equal(renewCalls[0].jobId, baseJob.jobId);
  assert.equal(renewCalls[0].leaseToken, baseJob.leaseToken);
  // No leaked timer still trying to renew a job this loop already moved past.
  const callsAtSettle = renewCalls.length;
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(renewCalls.length, callsAtSettle);
});

test('a transient failure settling a successful job is never misreported as a job failure', async () => {
  const queue = [baseJob];
  const settleCalls = [];
  let settleAttempts = 0;
  const api = {
    settleCalls,
    async claim() { return queue.shift() ?? null; },
    async settle(jobId, payload) {
      settleAttempts += 1;
      settleCalls.push({ jobId, payload });
      if (settleAttempts === 1) throw new Error('network blip on the settle call itself');
      return { job: { status: payload.outcome } };
    }
  };
  const adapter = {
    getSource: async () => ({ localPath: '/tmp/x', sizeBytes: 10, isPublic: false }),
    run: async () => ({ exitCode: 0, stdout: JSON.stringify(workingProbe) }),
    transcode: async () => {},
    verifyOutput: async () => true,
    createMedia: async (asset) => ({ ...asset, id: 'rendition-1' }),
    markSource: async () => {},
    cleanupPending: async () => {}
  };
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1 }, api, adapter, shouldStop: stopAfter(1) });
  // Exactly one settle attempt was made, for the real (successful) outcome --
  // never a second call reclassifying it as retryable_failure/permanent_failure.
  assert.equal(settleCalls.length, 1);
  assert.equal(settleCalls[0].payload.outcome, 'succeeded');
  assert.equal(settleCalls[0].payload.renditionAssetId, 'rendition-1');
});

test('a malformed job fails validateJob before touching the adapter, and settles as permanent', async () => {
  const api = fakeApi([{ ...baseJob, sourceKey: 'incoming/../../escape.mp4' }]);
  let adapterCalled = false;
  const adapter = { getSource: async () => { adapterCalled = true; return {}; } };
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1 }, api, adapter, shouldStop: stopAfter(1) });
  assert.equal(adapterCalled, false);
  assert.equal(api.settleCalls[0].payload.outcome, 'permanent_failure');
  assert.equal(api.settleCalls[0].payload.errorCode, 'INVALID_SOURCE_KEY');
  assert.equal('retryAfterSeconds' in api.settleCalls[0].payload, false);
});

test('an adapter/infrastructure failure (not a JobError) settles as retryable with a backoff', async () => {
  const api = fakeApi([baseJob]);
  const adapter = { getSource: async () => { throw new Error('S3 timed out'); }, run: async () => ({ exitCode: 0, stdout: '{}' }) };
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1 }, api, adapter, shouldStop: stopAfter(1) });
  assert.equal(api.settleCalls[0].payload.outcome, 'retryable_failure');
  assert.equal(api.settleCalls[0].payload.errorCode, 'WORKER_INTERNAL_ERROR');
  assert.equal(api.settleCalls[0].payload.retryAfterSeconds, 60);
});

test('a failure after a rendition plan was created cleans up whatever was already uploaded under it', async () => {
  const api = fakeApi([baseJob]);
  const cleanedPrefixes = [];
  const adapter = {
    getSource: async () => ({ localPath: '/tmp/x', sizeBytes: 10, isPublic: false }),
    run: async () => ({ exitCode: 0, stdout: JSON.stringify(workingProbe) }),
    transcode: async () => {},
    verifyOutput: async () => false,
    createMedia: async () => { throw new Error('must not be called'); },
    markSource: async () => { throw new Error('must not be called'); },
    cleanupPrefix: async (prefix) => { cleanedPrefixes.push(prefix); },
    cleanupPending: async () => {}
  };
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1 }, api, adapter, shouldStop: stopAfter(1) });
  assert.equal(cleanedPrefixes.length, 1);
  assert.match(cleanedPrefixes[0], /^renditions\/.+\/$/);
});

test('a failure before any rendition plan exists (e.g. a bad source) never calls cleanupPrefix', async () => {
  const api = fakeApi([baseJob]);
  let cleanupPrefixCalled = false;
  const adapter = {
    getSource: async () => { throw new Error('S3 timed out'); },
    cleanupPrefix: async () => { cleanupPrefixCalled = true; },
    cleanupPending: async () => {}
  };
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1 }, api, adapter, shouldStop: stopAfter(1) });
  assert.equal(cleanupPrefixCalled, false);
});

test('an incomplete rendition (verifyOutput false) never settles as succeeded', async () => {
  const api = fakeApi([baseJob]);
  const adapter = {
    getSource: async () => ({ localPath: '/tmp/x', sizeBytes: 10, isPublic: false }),
    run: async () => ({ exitCode: 0, stdout: JSON.stringify(workingProbe) }),
    transcode: async () => {},
    verifyOutput: async () => false,
    createMedia: async () => { throw new Error('must not be called'); },
    markSource: async () => { throw new Error('must not be called'); }
  };
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1 }, api, adapter, shouldStop: stopAfter(1) });
  assert.equal(api.settleCalls[0].payload.outcome, 'retryable_failure');
  assert.equal(api.settleCalls[0].payload.errorCode, 'OUTPUT_VERIFY_FAILED');
});

test('no available job just polls again without settling anything', async () => {
  const api = fakeApi([]);
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1 }, api, adapter: {}, shouldStop: stopAfter(2) });
  assert.equal(api.settleCalls.length, 0);
});

test('a claim transport error backs off and retries instead of crashing the loop', async () => {
  let calls = 0;
  const api = {
    settleCalls: [],
    async claim() { calls += 1; if (calls === 1) throw new Error('network blip'); return null; },
    async settle() { throw new Error('must not be called'); }
  };
  await runWorkerLoop({ config: { workerId: 'w', pollIntervalMs: 1 }, api, adapter: {}, shouldStop: stopAfter(2) });
  assert.equal(calls, 2);
});
