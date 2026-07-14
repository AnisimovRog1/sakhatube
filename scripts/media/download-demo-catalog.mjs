import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = resolve(import.meta.dirname, '../..');
const catalogPath = resolve(root, 'media/demo-catalog.json');
const outputRoot = resolve(root, 'media/source');
const maxBytes = 5 * 1024 * 1024 * 1024;
const downloadChunkBytes = 32 * 1024 * 1024;
const onlyId = process.argv.includes('--id') ? process.argv[process.argv.indexOf('--id') + 1] : null;

function extensionFrom(url) {
  const extension = new URL(url).pathname.split('.').pop()?.toLowerCase();
  return ['mp4', 'm4v', 'mov', 'mkv', 'avi'].includes(extension) ? extension : 'mp4';
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function download(item) {
  const extension = extensionFrom(item.sourceUrl);
  const output = resolve(outputRoot, `${item.id}.${extension}`);
  if (existsSync(output)) {
    const existing = await stat(output);
    if (existing.size > 0) {
      console.log(`Пропуск ${item.id}: уже есть ${formatBytes(existing.size)}`);
      return existing.size;
    }
  }

  const temporary = `${output}.part`;
  let downloadedBytes = existsSync(temporary) ? (await stat(temporary)).size : 0;
  const expectedBytes = item.sourceBytes;
  if (expectedBytes > maxBytes) throw new Error(`${item.id}: размер ${formatBytes(expectedBytes)} превышает безопасный предел 5 GB`);
  console.log(`Загрузка ${item.id}: ${formatBytes(expectedBytes)}${downloadedBytes ? `, продолжаю с ${formatBytes(downloadedBytes)}` : ''}`);

  const maxAttempts = Math.ceil(expectedBytes / downloadChunkBytes) + 2;
  for (let attempt = 1; downloadedBytes < expectedBytes && attempt <= maxAttempts; attempt += 1) {
    const rangeEnd = Math.min(downloadedBytes + downloadChunkBytes - 1, expectedBytes - 1);
    const headers = { Range: `bytes=${downloadedBytes}-${rangeEnd}` };
    const response = await fetch(item.sourceUrl, { redirect: 'follow', headers });
    if (response.status !== 206 || !response.body) throw new Error(`${item.id}: источник не поддерживает безопасное докачивание (HTTP ${response.status})`);
    const contentRange = response.headers.get('content-range');
    const range = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
    if (!range) throw new Error(`${item.id}: источник не прислал проверяемый Content-Range`);
    const [, responseStart, responseEnd, responseTotal] = range.map(Number);
    if (responseStart !== downloadedBytes || responseEnd !== rangeEnd || responseTotal !== expectedBytes) {
      throw new Error(`${item.id}: источник вернул неверный диапазон ${contentRange}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: downloadedBytes ? 'a' : 'w' }));
    downloadedBytes = (await stat(temporary)).size;
    if (downloadedBytes !== rangeEnd + 1) throw new Error(`${item.id}: размер полученного фрагмента не совпал с Content-Range`);
    if (downloadedBytes < expectedBytes) console.log(`Повтор ${attempt}: получено ${formatBytes(downloadedBytes)} из ${formatBytes(expectedBytes)}`);
  }

  const downloaded = await stat(temporary);
  if (downloaded.size < 1_024) throw new Error(`${item.id}: получен слишком маленький файл`);
  if (downloaded.size !== expectedBytes) throw new Error(`${item.id}: не удалось получить полный файл после повторных попыток`);
  await rename(temporary, output);
  console.log(`Готово ${item.id}: ${formatBytes(downloaded.size)}`);
  return downloaded.size;
}

await mkdir(outputRoot, { recursive: true });
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const selected = onlyId ? catalog.items.filter((item) => item.id === onlyId) : catalog.items;
if (!selected.length) throw new Error(`В каталоге не найдено демо: ${onlyId}`);
const declaredBytes = selected.reduce((total, item) => total + item.sourceBytes, 0);
if (declaredBytes > maxBytes) throw new Error(`Выбранный набор занимает ${formatBytes(declaredBytes)} и превышает предел 5 GB`);

let downloadedBytes = 0;
for (const item of selected) downloadedBytes += await download(item);
console.log(`Легальный демо-каталог готов: ${formatBytes(downloadedBytes)}`);
