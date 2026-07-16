import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJob, validateProbe, createRenditionPlan, toReadyAsset, JobError } from '../src/contract.mjs';

const job = { jobId: '11111111-1111-4111-8111-111111111111', sourceAssetId: '22222222-2222-4222-8222-222222222222', contentId: '33333333-3333-4333-8333-333333333333', sourceKey: 'incoming/2026-07-16/22222222-2222-4222-8222-222222222222/source.mp4', contentType: 'video/mp4', sizeBytes: 10 };
const probe = { format: { duration: '61.2' }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080 }, { codec_type: 'audio', codec_name: 'aac' }] };

test('accepts only API-shaped private incoming jobs', () => assert.equal(validateJob(job).sourceKey, job.sourceKey));
test('rejects traversal and unknown MIME before download', () => {
  assert.throws(() => validateJob({ ...job, sourceKey: 'incoming/../../secret.mp4' }), JobError);
  assert.throws(() => validateJob({ ...job, contentType: 'application/octet-stream' }), JobError);
});
test('probe validation creates private relative-key HLS plan', () => {
  const parsed = validateProbe(probe);
  const plan = createRenditionPlan(job, parsed, new Date('2026-07-16T00:00:00.000Z'));
  const asset = toReadyAsset(plan);
  assert.equal(parsed.durationMs, 61200);
  assert.match(plan.manifestKey, /^renditions\//);
  assert.equal(asset.metadata.playback.hls.manifestKey, asset.storageKey);
  assert.equal(asset.metadata.poster.key.startsWith('renditions/'), true);
});
test('rejects video-less and extreme probes', () => {
  assert.throws(() => validateProbe({ format: { duration: '1' }, streams: [] }), JobError);
  assert.throws(() => validateProbe({ ...probe, streams: [{ codec_type: 'video', width: 9000, height: 1080 }] }), JobError);
});
