import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const root = resolve(import.meta.dirname, '../..');
const inputRoot = resolve(root, 'media/hls');
const outputRoot = resolve(inputRoot, 'cc-test-set');
const ffmpeg = process.env.FFMPEG_PATH || ffmpegPath;
const shortBatchArgument = process.argv.find((argument) => argument.startsWith('--shorts='));
const shortBatch = shortBatchArgument
  ? shortBatchArgument.replace('--shorts=', '').split(':').map(Number)
  : null;

// This is intentionally a small derivative set: three episodes form one demo
// mini-series and two independent titles complete the five long-form cards.
// All derivatives retain the attribution of their Blender source asset.
const longVideos = [
  { id: 'sintel-01', source: 'sintel-demo/episode/preview.mp4', sourceId: 'sintel', start: 0, duration: 24, title: 'Sintel: начало пути', kind: 'episode', seriesId: 'sintel-mini-series', episode: 1 },
  { id: 'sintel-02', source: 'sintel-demo/episode/preview.mp4', sourceId: 'sintel', start: 24, duration: 24, title: 'Sintel: след на снегу', kind: 'episode', seriesId: 'sintel-mini-series', episode: 2 },
  { id: 'sintel-03', source: 'sintel-demo/episode/preview.mp4', sourceId: 'sintel', start: 36, duration: 24, title: 'Sintel: решение', kind: 'episode', seriesId: 'sintel-mini-series', episode: 3 },
  { id: 'bunny-01', source: 'big-buck-bunny-demo/episode/preview.mp4', sourceId: 'big-buck-bunny', start: 0, duration: 30, title: 'Big Buck Bunny: утро', kind: 'movie' },
  { id: 'bunny-02', source: 'big-buck-bunny-demo/episode/preview.mp4', sourceId: 'big-buck-bunny', start: 30, duration: 30, title: 'Big Buck Bunny: навстречу', kind: 'movie' }
];

const shortSeeds = [
  { id: 'sintel-01', source: 'sintel-demo/episode/preview.mp4', sourceId: 'sintel', start: 34 },
  { id: 'sintel-02', source: 'sintel-demo/episode/preview.mp4', sourceId: 'sintel', start: 40 },
  { id: 'sintel-03', source: 'sintel-demo/episode/preview.mp4', sourceId: 'sintel', start: 46 },
  { id: 'sintel-04', source: 'sintel-demo/episode/preview.mp4', sourceId: 'sintel', start: 50 },
  { id: 'sintel-05', source: 'sintel-demo/episode/preview.mp4', sourceId: 'sintel', start: 54 },
  { id: 'bunny-01', source: 'big-buck-bunny-demo/episode/preview.mp4', sourceId: 'big-buck-bunny', start: 12 },
  { id: 'bunny-02', source: 'big-buck-bunny-demo/episode/preview.mp4', sourceId: 'big-buck-bunny', start: 18 },
  { id: 'bunny-03', source: 'big-buck-bunny-demo/episode/preview.mp4', sourceId: 'big-buck-bunny', start: 24 },
  { id: 'bunny-04', source: 'big-buck-bunny-demo/episode/preview.mp4', sourceId: 'big-buck-bunny', start: 30 },
  { id: 'bunny-05', source: 'big-buck-bunny-demo/episode/preview.mp4', sourceId: 'big-buck-bunny', start: 36 }
];

const attribution = {
  sintel: {
    title: 'Sintel',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    credit: '© Blender Foundation | durian.blender.org'
  },
  'big-buck-bunny': {
    title: 'Big Buck Bunny',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    credit: '© Blender Foundation | www.bigbuckbunny.org'
  }
};

function run(args) {
  return new Promise((resolvePromise, reject) => {
    const process = spawn(ffmpeg, args, { stdio: 'ignore' });
    process.once('error', reject);
    process.once('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`FFmpeg завершился с кодом ${code}`)));
  });
}

function source(relativePath) {
  const file = resolve(inputRoot, relativePath);
  if (!existsSync(file)) throw new Error(`Нет исходника ${relativePath}. Сначала подготовьте лицензионные демо-файлы.`);
  return file;
}

async function createLong(video) {
  const input = source(video.source);
  const output = resolve(outputRoot, 'long', `${video.id}.mp4`);
  const poster = resolve(outputRoot, 'posters', `${video.id}.jpg`);
  await run(['-y', '-ss', String(video.start), '-t', String(video.duration), '-i', input, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output]);
  await run(['-y', '-ss', String(video.start + 2), '-i', input, '-frames:v', '1', '-q:v', '3', poster]);
}

async function createShort(short) {
  const input = source(short.source);
  const output = resolve(outputRoot, 'shorts', `${short.id}.mp4`);
  const poster = resolve(outputRoot, 'short-posters', `${short.id}.jpg`);
  // Each output is a true 1080×1920 canvas. The original landscape frame remains sharp
  // in the centre while a softened version fills the portrait background; no destructive crop.
  const verticalComposition = '[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10[bgblur];[fg]scale=1080:-2,setsar=1[fgsharp];[bgblur][fgsharp]overlay=(W-w)/2:(H-h)/2:shortest=1,setsar=1[out]';
  await run(['-y', '-ss', String(short.start), '-t', '6', '-i', input, '-filter_complex', verticalComposition, '-map', '[out]', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart', output]);
  await run(['-y', '-ss', '1', '-i', output, '-frames:v', '1', '-q:v', '3', poster]);
}

if (!ffmpeg) throw new Error('FFmpeg не установлен');
if (!shortBatch) await rm(outputRoot, { recursive: true, force: true });
await Promise.all(['long', 'shorts', 'posters', 'short-posters'].map((directory) => mkdir(resolve(outputRoot, directory), { recursive: true })));

if (!shortBatch) {
  for (const video of longVideos) await createLong(video);
}
const selectedShorts = shortBatch ? shortSeeds.slice(shortBatch[0], shortBatch[1]) : shortSeeds;
for (const short of selectedShorts) await createShort(short);

if (!shortBatch) {
  await writeFile(resolve(outputRoot, 'credits.json'), `${JSON.stringify({
    notice: 'Temporary Creative Commons test media. Replace before public launch.',
    sources: Object.values(attribution),
    longVideos: longVideos.map(({ id, title, kind, seriesId, episode, duration, sourceId }) => ({ id, title, kind, seriesId, episode, duration, source: attribution[sourceId] })),
    shortVideos: shortSeeds.map(({ id, sourceId }) => ({ id, duration: 6, aspectRatio: '9:16', source: attribution[sourceId] }))
  }, null, 2)}\n`);
  await writeFile(resolve(outputRoot, 'catalog.json'), `${JSON.stringify({
    version: 1,
    purpose: 'Temporary, non-commercial Creative Commons playback test set. Remove or replace before public launch.',
    series: [{
      id: 'sintel-mini-series',
      title: 'Sintel — мини-сериал',
      episodeIds: longVideos.filter((video) => video.seriesId === 'sintel-mini-series').map((video) => video.id),
      source: attribution.sintel
    }],
    longForm: longVideos.map(({ id, title, kind, seriesId, episode, duration, sourceId }) => ({
      id, title, kind, seriesId, episode, duration, video: `long/${id}.mp4`, poster: `posters/${id}.jpg`, source: attribution[sourceId]
    })),
    shorts: shortSeeds.map(({ id, sourceId }) => ({
      id, duration: 6, aspectRatio: '9:16', video: `shorts/${id}.mp4`, poster: `short-posters/${id}.jpg`, source: attribution[sourceId]
    }))
  }, null, 2)}\n`);
}

console.log(`Готово: ${shortBatch ? selectedShorts.length : shortSeeds.length} вертикальных клипов${shortBatch ? ' в выбранной партии' : ` и ${longVideos.length} длинных видео`}.`);
