import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Resolved once, at module load. In the container these stay 'ffmpeg'/
// 'ffprobe' and are found on PATH (see ../Dockerfile's apt-get install).
// Locally, FFMPEG_PATH/FFPROBE_PATH can point at ffmpeg-static/ffprobe-static
// so a developer never needs a system ffmpeg install.
export const ffmpegBinary = process.env.FFMPEG_PATH || 'ffmpeg';
export const ffprobeBinary = process.env.FFPROBE_PATH || 'ffprobe';

const BITRATE_BY_HEIGHT = { 1080: 5_000_000, 720: 2_800_000, 540: 1_400_000, 360: 800_000 };
const bandwidthFor = (height) => BITRATE_BY_HEIGHT[height] ?? Math.max(300_000, Math.round(height * 1_400));
// scale=-2 rounds to the nearest even width; mirrored here only to label the
// master playlist's advisory RESOLUTION tag, not to control the real encode.
const evenWidthFor = (sourceWidth, sourceHeight, targetHeight) => 2 * Math.round((sourceWidth * targetHeight) / sourceHeight / 2);

// Never a shell string: binary + argv array only.
export async function runProcess(binary, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, { cwd: options.cwd, timeout: options.timeoutMs ?? 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return { exitCode: typeof error.code === 'number' ? error.code : 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

export async function probeSource(sourcePath) {
  return runProcess(ffprobeBinary, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', sourcePath]);
}

// Runs in its own cwd so ffmpeg's HLS muxer writes plain relative segment
// names (seg_00001.ts, index.m3u8) with no local path ever entering the
// manifest — the API gateway rejects any absolute/root-relative HLS URI.
export async function transcodeVariant({ sourcePath, height, hasAudio, outputDir }) {
  // pix_fmt is forced to yuv420p regardless of the source's chroma sampling:
  // H.264 "main" cannot encode 4:2:2/4:4:4, and most players/devices can't
  // decode those even under "high444" — 4:2:0 is the only broadly safe choice.
  const videoArgs = ['-vf', `scale=-2:${height}`, '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'veryfast', '-crf', '20', '-sc_threshold', '0', '-g', '48', '-keyint_min', '48'];
  const audioArgs = hasAudio ? ['-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '128k'] : ['-an'];
  const hlsArgs = ['-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments', '-hls_segment_filename', 'seg_%05d.ts', 'index.m3u8'];
  const result = await runProcess(ffmpegBinary, ['-y', '-i', sourcePath, ...videoArgs, ...audioArgs, ...hlsArgs], { cwd: outputDir });
  if (result.exitCode !== 0) throw new Error(`ffmpeg вышел с кодом ${result.exitCode} при кодировании ${height}p: ${tail(result.stderr)}`);
}

export async function extractPoster({ sourcePath, destPath, atSeconds }) {
  const result = await runProcess(ffmpegBinary, ['-y', '-ss', String(Math.max(0, atSeconds)), '-i', sourcePath, '-frames:v', '1', '-q:v', '3', destPath]);
  if (result.exitCode !== 0) throw new Error(`ffmpeg вышел с кодом ${result.exitCode} при извлечении постера: ${tail(result.stderr)}`);
}

const tail = (text, maxChars = 400) => (text || '').trim().slice(-maxChars);

export function buildMasterPlaylist(renditions, sourceWidth, sourceHeight) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const rendition of renditions) {
    const width = evenWidthFor(sourceWidth, sourceHeight, rendition.height);
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidthFor(rendition.height)},RESOLUTION=${width}x${rendition.height}`);
    // Relative to the master's own key — both live under the same plan.prefix.
    lines.push(`v${rendition.height}/index.m3u8`);
  }
  return `${lines.join('\n')}\n`;
}

// Mirrors server/app.js's hlsManifestIsGatewaySafe(). Duplicated deliberately
// (see store.mjs) — if either side's rule changes, the other must follow.
export function manifestIsGatewaySafe(text) {
  if (!text.startsWith('#EXTM3U')) return false;
  return !/(?:https?:\/\/|URI=["']\/|^\/)/mi.test(text);
}
