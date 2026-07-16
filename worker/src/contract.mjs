import { randomUUID } from 'node:crypto';

export const MAX_SOURCE_BYTES = 50 * 1024 * 1024 * 1024;
export const allowedSourceTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export class JobError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);

/** Rejects malformed / unsafe queue messages before any download or command runs. */
export function validateJob(input) {
  if (!input || typeof input !== 'object') throw new JobError('INVALID_JOB', 'Job must be an object');
  const { jobId, sourceAssetId, contentId, sourceKey, contentType, sizeBytes } = input;
  if (!isUuid(jobId) || !isUuid(sourceAssetId) || !isUuid(contentId)) throw new JobError('INVALID_JOB', 'IDs must be UUIDs');
  if (typeof sourceKey !== 'string' || !/^incoming\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\/source\.(mp4|mov|webm)$/i.test(sourceKey)) {
    throw new JobError('INVALID_SOURCE_KEY', 'Source must be an API-created incoming key');
  }
  if (!allowedSourceTypes.has(contentType)) throw new JobError('UNSUPPORTED_MEDIA_TYPE', 'Source MIME type is not allowed');
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_SOURCE_BYTES) throw new JobError('INVALID_SIZE', 'Source size is invalid');
  return { jobId, sourceAssetId, contentId, sourceKey, contentType, sizeBytes, attempt: Number(input.attempt || 1) };
}

/** Parses ffprobe JSON conservatively. No probe result means no transcode. */
export function validateProbe(raw) {
  const format = raw?.format;
  const streams = Array.isArray(raw?.streams) ? raw.streams : [];
  const video = streams.find((stream) => stream?.codec_type === 'video');
  if (!format || !video) throw new JobError('PROBE_NO_VIDEO', 'No video stream');
  const duration = Number(format.duration);
  const width = Number(video.width);
  const height = Number(video.height);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 12 * 60 * 60) throw new JobError('PROBE_DURATION', 'Invalid duration');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 64 || height < 64 || width > 7680 || height > 4320) {
    throw new JobError('PROBE_DIMENSIONS', 'Invalid dimensions');
  }
  const audio = streams.find((stream) => stream?.codec_type === 'audio');
  return { durationMs: Math.round(duration * 1000), width, height, videoCodec: video.codec_name || 'unknown', hasAudio: Boolean(audio) };
}

export function createRenditionPlan(job, probe, now = new Date()) {
  const releaseId = randomUUID();
  const prefix = `renditions/${releaseId}/`;
  // A valid source is allowed down to 64px for archival/test material.  Do not
  // produce a master manifest with zero variants for sources below 360px:
  // retain the source height as a single playable rendition instead.
  const heights = [360, 540, 720, 1080].filter((height) => height <= probe.height);
  if (!heights.length) heights.push(probe.height);
  return {
    releaseId, sourceAssetId: job.sourceAssetId, contentId: job.contentId,
    prefix, manifestKey: `${prefix}master.m3u8`, posterKey: `${prefix}poster.jpg`,
    generatedAt: now.toISOString(), durationMs: probe.durationMs,
    renditions: heights.map((height) => ({ height, playlistKey: `${prefix}v${height}/index.m3u8` }))
  };
}

export function toReadyAsset(plan) {
  return {
    kind: 'hls', relation: 'rendition', status: 'ready', contentId: plan.contentId,
    storageKey: plan.manifestKey, fileName: 'master.m3u8', contentType: 'application/vnd.apple.mpegurl', size: 0,
    durationMs: plan.durationMs,
    metadata: { playback: { hls: { state: 'ready', prefix: plan.prefix, manifestKey: plan.manifestKey, generatedAt: plan.generatedAt } }, poster: { key: plan.posterKey } }
  };
}
