import { readFile, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

if (process.env.CONFIRM_DEMO_UPLOAD !== 'yes') {
  throw new Error('Это загрузит тестовые видео в Bucket. Запустите только с CONFIRM_DEMO_UPLOAD=yes.');
}

const required = ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Не заданы переменные Bucket: ${missing.join(', ')}`);

const root = resolve(import.meta.dirname, '../..');
const catalog = JSON.parse(await readFile(resolve(root, 'media/demo-catalog.json'), 'utf8'));
const hlsRoot = resolve(root, 'media/hls');
const onlyId = process.argv.includes('--id') ? process.argv[process.argv.indexOf('--id') + 1] : null;
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
});

const mimeTypes = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.json': 'application/json'
};

async function allFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = resolve(directory, entry.name);
    return entry.isDirectory() ? allFiles(fullPath) : [fullPath];
  }));
  return nested.flat();
}

const selected = onlyId ? catalog.items.filter((item) => item.id === onlyId) : catalog.items;
if (!selected.length) throw new Error(`В каталоге не найдено демо: ${onlyId}`);

for (const item of selected) {
  const directory = resolve(hlsRoot, item.id);
  const files = await allFiles(directory);
  for (const file of files) {
    const fileRelativePath = relative(directory, file).replaceAll('\\', '/');
    const key = `demo-media/${item.id}/${fileRelativePath}`;
    const extension = extname(file).toLowerCase();
    await client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: createReadStream(file),
      ContentType: mimeTypes[extension] || 'application/octet-stream',
      CacheControl: extension === '.m3u8' ? 'no-cache' : 'public, max-age=31536000, immutable',
      // S3-compatible buckets may reject non-ASCII metadata headers.
      // Full licence and credit stay in the uploaded credits.json file.
      Metadata: { demo: 'true', contentid: item.id }
    }));
    console.log(`Загружен ${key}`);
  }
}
