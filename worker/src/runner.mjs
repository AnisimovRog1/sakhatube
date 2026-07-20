import { validateJob, validateProbe, createRenditionPlan, toReadyAsset, JobError } from './contract.mjs';

// Integration boundary. The API/queue adapter must implement only these private
// operations: getSource(key), putPrivate(key, body, type), createMedia(asset),
// markSource(id, patch), and run(command, args). It must not return public URLs.
export async function processJob(input, deps) {
  const job = validateJob(input);
  if (!deps || typeof deps.getSource !== 'function' || typeof deps.run !== 'function') throw new JobError('WORKER_CONFIG', 'Private storage and runner are required');
  const source = await deps.getSource(job.sourceKey);
  if (!source || source.isPublic === true) throw new JobError('PRIVATE_SOURCE_REQUIRED', 'Source must be private');
  if (Number.isFinite(source.sizeBytes) && source.sizeBytes !== job.sizeBytes) throw new JobError('SOURCE_SIZE_MISMATCH', 'Source object changed');
  const probeRun = await deps.run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', source.localPath]);
  if (probeRun.exitCode !== 0) throw new JobError('FFPROBE_FAILED', 'ffprobe failed');
  let raw;
  try { raw = JSON.parse(probeRun.stdout); } catch { throw new JobError('FFPROBE_INVALID_JSON', 'ffprobe did not return JSON'); }
  const probe = validateProbe(raw);
  const plan = createRenditionPlan(job, probe, deps.now?.() || new Date());
  try {
    // The actual adapter is responsible for isolated temp paths, HLS generation,
    // upload of every relative URI, and atomic completion. This foundation refuses
    // to mark an item ready until that adapter explicitly proves all output exists.
    if (typeof deps.transcode !== 'function' || typeof deps.verifyOutput !== 'function') throw new JobError('WORKER_CONFIG', 'Transcode and output verification are required');
    await deps.transcode({ source, plan, probe });
    const outputOk = await deps.verifyOutput(plan);
    if (outputOk !== true) throw new JobError('OUTPUT_VERIFY_FAILED', 'Rendition is incomplete');
    const ready = toReadyAsset(plan);
    if (typeof deps.createMedia !== 'function' || typeof deps.markSource !== 'function') throw new JobError('WORKER_CONFIG', 'Media persistence is required');
    const rendition = await deps.createMedia(ready);
    await deps.markSource(job.sourceAssetId, { status: 'processed', durationMs: plan.durationMs, metadata: { processingState: 'ready', renditionAssetId: rendition.id, posterKey: plan.posterKey } });
    return { rendition, plan };
  } catch (error) {
    // plan.prefix is a fresh randomUUID() per attempt (createRenditionPlan),
    // so transcode() may already have uploaded some renditions/segments
    // under it before this failed -- attach the plan so service.mjs's
    // failure handler can clean up whatever got orphaned, without this
    // module needing to know anything about S3 itself.
    error.plan = plan;
    throw error;
  }
}

// A queue adapter belongs to deployment infrastructure, not this process. This
// intentionally fails closed instead of polling DB or exposing a half-configured worker.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('No queue adapter configured. See worker/README.md.');
  process.exitCode = 78;
}
