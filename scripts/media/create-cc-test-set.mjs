import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const root = resolve(import.meta.dirname, '../..');
const inputRoot = resolve(root, 'media/hls');
const outputRoot = resolve(inputRoot, 'cc-test-set');
const ffmpeg = process.env.FFMPEG_PATH || ffmpegPath;

const longVideos = [
  { id: 'sintel-01', source: 'sintel-demo/episode/preview.mp4', start: 0, duration: 24, title: 'Sintel: начало пути' },
  { id: 'sintel-02', source: 'sintel-demo/episode/preview.mp4', start: 24, duration: 24, title: 'Sintel: след на снегу' },
  { id: 'sintel-03', source: 'sintel-demo/episode/preview.mp4', start: 36, duration: 24, title: 'Sintel: решение' },
  { id: 'bunny-01', source: 'big-buck-bunny-demo/episode/preview.mp4', start: 0, duration: 30, title: 'Big Buck Bunny: утро' },
  { id: 'bunny-02', source: 'big-buck-bunny-demo/episode/preview.mp4', start: 30, duration: 30, title: 'Big Buck Bunny: навстречу' }
];

const shortSeeds = [
  ['sintel-01', 'sintel-demo/episode/preview.mp4', 0],
  ['sintel-02', 'sintel-demo/episode/preview.mp4', 6],
  ['sintel-03', 'sintel-demo/episode/preview.mp4', 12],
  ['sintel-04', 'sintel-demo/episode/preview.mp4', 18],
  ['sintel-05', 'sintel-demo/episode/preview.mp4', 24],
  ['bunny-01', 'big-buck-bunny-demo/episode/preview.mp4', 0],
  ['bunny-02', 'big-buck-bunny-demo/episode/preview.mp4', 6],
  ['bunny-03', 'big-buck-bunny-demo/episode/preview.mp4', 12],
  ['bunny-04', 'big-buck-bunny-demo/episode/preview.mp4', 18],
  ['bunny-05', 'big-buck-bunny-demo/episode/preview.mp4', 24]
];

function run(args) {
  return new Promise((resolvePromise, reject) => {
    const process = spawn(ffmpeg, args, { stdio: ['ignore', 'inherit', 'inherit'] });
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

async function createShort([id, sourcePath, start]) {
  const input = source(sourcePath);
  const output = resolve(outputRoot, 'shorts', `${id}.mp4`);
  const poster = resolve(outputRoot, 'short-posters', `${id}.jpg`);
  // The source footage is landscape. Crop a safe centre area into a vertical 9:16 test clip.
  await run(['-y', '-ss', String(start), '-t', '6', '-i', input, '-vf', 'scale=-2:1920,crop=1080:1920', '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart', output]);
  await run(['-y', '-ss', String(start + 1), '-i', input, '-vf', 'scale=-2:1920,crop=1080:1920', '-frames:v', '1', '-q:v', '3', poster]);
}

if (!ffmpeg) throw new Error('FFmpeg не установлен');
await rm(outputRoot, { recursive: true, force: true });
await Promise.all(['long', 'shorts', 'posters', 'short-posters'].map((directory) => mkdir(resolve(outputRoot, directory), { recursive: true })));

for (const video of longVideos) await createLong(video);
for (const short of shortSeeds) await createShort(short);

await writeFile(resolve(outputRoot, 'credits.json'), `${JSON.stringify({
  notice: 'Temporary Creative Commons test media. Replace before public launch.',
  sources: [
    { title: 'Sintel', license: 'CC BY 3.0', credit: '© Blender Foundation | durian.blender.org' },
    { title: 'Big Buck Bunny', license: 'CC BY 3.0', credit: '© Blender Foundation | www.bigbuckbunny.org' }
  ],
  longVideos: longVideos.map(({ id, title }) => ({ id, title })),
  shortVideos: shortSeeds.map(([id]) => ({ id }))
}, null, 2)}\n`);

console.log(`Готово: ${longVideos.length} длинных видео и ${shortSeeds.length} вертикальных клипов.`);
