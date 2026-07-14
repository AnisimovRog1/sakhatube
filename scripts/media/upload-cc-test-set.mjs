import { readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

if (process.env.CONFIRM_DEMO_UPLOAD !== 'yes') throw new Error('Подтвердите загрузку: CONFIRM_DEMO_UPLOAD=yes');

const required = ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Не заданы переменные Bucket: ${missing.join(', ')}`);

const root = resolve(import.meta.dirname, '../..');
const setRoot = resolve(root, 'media/hls/cc-test-set');
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
});
const mimeTypes = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.json': 'application/json' };

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const full = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  }))).flat();
}

const files = await listFiles(setRoot);
await Promise.all(files.map(async (file) => {
  const path = relative(setRoot, file).replaceAll('\\', '/');
  const extension = extname(file).toLowerCase();
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: `demo-media/cc-test-set/${path}`,
    Body: createReadStream(file),
    ContentType: mimeTypes[extension] || 'application/octet-stream',
    CacheControl: extension === '.json' ? 'no-cache' : 'public, max-age=31536000, immutable',
    Metadata: { demo: 'true', contentid: 'cc-test-set' }
  }));
  console.log(`Загружен cc-test-set/${path}`);
}));
