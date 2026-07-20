import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
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
    // Distinct from objectExists: a HEAD that succeeds only tells you the
    // key was written, not that ffmpeg produced a real segment there -- an
    // anomalous zero-byte upload (e.g. a truncated last segment written
    // without ffmpeg exiting non-zero) would pass objectExists and still get
    // reported as a verified, playable rendition.
    async objectSize(key) {
      try {
        const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return Number(response.ContentLength ?? 0);
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return null;
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
    },
    // Every failed-partway or retried job leaves whatever renditions/*
    // objects it already uploaded (a fresh randomUUID() releaseId prefix is
    // minted per attempt, see contract.mjs's createRenditionPlan) with no
    // other code path that ever deletes them. Called from service.mjs's
    // failure handler whenever a plan was already created for the attempt
    // that just failed.
    async deletePrefix(prefix) {
      let continuationToken;
      do {
        const page = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken
        }));
        const keys = (page.Contents ?? []).map((object) => ({ Key: object.Key }));
        if (keys.length) {
          await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);
    }
  };
}
