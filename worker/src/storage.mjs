import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';

// Deliberately minimal and self-contained (see store.mjs for why): only the
// operations the worker actually needs, uploading exclusively with
// `Cache-Control: private, no-store` so nothing it writes is ever cacheable
// as a public asset by accident.
export function createWorkerStorage(config) {
  if (!config?.endpoint || !config?.accessKeyId || !config?.secretAccessKey || !config?.bucket) {
    throw new Error('S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY и S3_BUCKET обязательны для воркера');
  }
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region || 'auto',
    forcePathStyle: false,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });
  const bucket = config.bucket;

  return {
    async downloadToFile(key, destPath) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      await pipeline(response.Body, createWriteStream(destPath));
      const { size } = await stat(destPath);
      return size;
    },
    async uploadFile(key, localPath, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(localPath),
        ContentType: contentType,
        CacheControl: 'private, no-store'
      }));
    },
    async objectExists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false;
        throw error;
      }
    },
    async readText(key, maxBytes = 1_048_576) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const chunks = [];
      let total = 0;
      for await (const chunk of response.Body) {
        total += chunk.length;
        if (total > maxBytes) throw new Error(`Объект ${key} превышает ожидаемый размер манифеста`);
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString('utf8');
    }
  };
}
