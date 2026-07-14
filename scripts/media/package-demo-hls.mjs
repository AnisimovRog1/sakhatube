import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const root = resolve(import.meta.dirname, '../..');
const catalogPath = resolve(root, 'media/demo-catalog.json');
const sourceRoot = resolve(root, 'media/source');
const outputRoot = resolve(root, 'media/hls');
const onlyId = process.argv.includes('--id') ? process.argv[process.argv.indexOf('--id') + 1] : null;
const previewSeconds = process.argv.includes('--preview-seconds') ? Number(process.argv[process.argv.indexOf('--preview-seconds') + 1]) : null;
const ffmpeg = process.env.FFMPEG_PATH || ffmpegPath;

function run(args) {
  return new Promise((resolvePromise, reject) => {
    const process = spawn(ffmpeg, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    process.once('error', reject);
    process.once('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`FFmpeg завершился с кодом ${code}`)));
  });
}

function sourceFor(item) {
  const candidates = ['mp4', 'm4v', 'mov', 'mkv', 'avi'].map((extension) => resolve(sourceRoot, `${item.id}.${extension}`));
  const source = candidates.find(existsSync) ?? (previewSeconds ? candidates.map((file) => `${file}.part`).find(existsSync) : null);
  if (!source) throw new Error(`Не найден исходник ${item.id}. Сначала запустите npm run media:download-demo -- --id ${item.id}`);
  return source;
}

async function packageItem(item) {
  const source = sourceFor(item);
  const clipStart = previewSeconds ? Math.min(item.clip.startSeconds, Math.max(0, previewSeconds - 12)) : item.clip.startSeconds;
  const clipDuration = previewSeconds
    ? Math.min(item.clip.durationSeconds, Math.max(6, previewSeconds - clipStart))
    : item.clip.durationSeconds;
  const itemRoot = resolve(outputRoot, item.id);
  const landscape = resolve(itemRoot, 'episode');
  const vertical = resolve(itemRoot, 'clip');
  await rm(itemRoot, { recursive: true, force: true });
  await mkdir(landscape, { recursive: true });
  await mkdir(vertical, { recursive: true });

  await run([
    '-y', '-i', source,
    ...(previewSeconds ? ['-t', String(previewSeconds)] : []),
    '-filter_complex', '[0:v]split=2[v540][v720];[v540]scale=-2:540[v540out];[v720]scale=-2:720[v720out]',
    '-map', '[v540out]', '-map', '0:a:0?', '-map', '[v720out]', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high',
    '-b:v:0', '1300k', '-maxrate:v:0', '1600k', '-bufsize:v:0', '2600k',
    '-b:v:1', '2300k', '-maxrate:v:1', '2800k', '-bufsize:v:1', '4600k',
    '-c:a', 'aac', '-b:a:0', '128k', '-b:a:1', '128k', '-ac', '2',
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    '-var_stream_map', 'v:0,a:0,name:540p v:1,a:1,name:720p',
    '-master_pl_name', 'master.m3u8',
    '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments',
    '-hls_segment_filename', resolve(landscape, 'v%v', 'segment_%05d.ts'),
    resolve(landscape, 'v%v', 'index.m3u8')
  ]);

  await run([
    '-y', '-ss', String(clipStart), '-t', String(clipDuration), '-i', source,
    '-vf', 'scale=-2:1920,crop=1080:1920',
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    resolve(vertical, 'clip.mp4')
  ]);

  await run(['-y', '-ss', '00:00:15', '-i', source, '-frames:v', '1', '-q:v', '3', resolve(itemRoot, 'poster.jpg')]);
  await writeFile(resolve(itemRoot, 'credits.json'), `${JSON.stringify({
    title: item.title,
    license: item.license,
    source: item.sourceUrl,
    generatedAt: new Date().toISOString(),
    files: {
      hlsMaster: 'episode/master.m3u8',
      verticalClip: 'clip/clip.mp4',
      poster: 'poster.jpg'
    }
  }, null, 2)}\n`);
  console.log(`HLS и клип готовы: ${item.id} (${basename(source)})`);
}

if (!ffmpeg) throw new Error('FFmpeg не установлен');
if (previewSeconds && (!Number.isFinite(previewSeconds) || previewSeconds < 12 || previewSeconds > 600)) throw new Error('Для preview-seconds укажите число от 12 до 600');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const selected = onlyId ? catalog.items.filter((item) => item.id === onlyId) : catalog.items;
if (!selected.length) throw new Error(`В каталоге не найдено демо: ${onlyId}`);
await mkdir(outputRoot, { recursive: true });
for (const item of selected) await packageItem(item);
