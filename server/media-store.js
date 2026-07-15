import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function createMediaStore(config) {
  if (!config?.endpoint || !config?.accessKeyId || !config?.secretAccessKey || !config?.bucket) return null;
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region || 'auto',
    forcePathStyle: false,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });

  return {
    async put({ storageKey, body, contentType, cacheControl }) {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl || 'public, max-age=31536000, immutable'
      }));
    },
    async get(storageKey, range) {
      return client.send(new GetObjectCommand({ Bucket: config.bucket, Key: storageKey, ...(range ? { Range: range } : {}) }));
    },
    async remove(storageKey) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    },
    // Source uploads intentionally remain private. A later worker reads this
    // incoming object, validates it, and writes viewer-facing renditions to a
    // separate entitlement-controlled location.
    async createMultipartUpload({ storageKey, contentType, metadata = {} }) {
      const response = await client.send(new CreateMultipartUploadCommand({
        Bucket: config.bucket,
        Key: storageKey,
        ContentType: contentType,
        CacheControl: 'no-store',
        ContentDisposition: 'attachment',
        Metadata: metadata
      }));
      if (!response.UploadId) throw new Error('S3 не вернул UploadId для multipart-загрузки');
      return { uploadId: response.UploadId };
    },
    async presignUploadPart({ storageKey, uploadId, partNumber, expiresIn = 900 }) {
      return getSignedUrl(client, new UploadPartCommand({
        Bucket: config.bucket,
        Key: storageKey,
        UploadId: uploadId,
        PartNumber: partNumber
      }), { expiresIn });
    },
    async completeMultipartUpload({ storageKey, uploadId, parts }) {
      return client.send(new CompleteMultipartUploadCommand({
        Bucket: config.bucket,
        Key: storageKey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map(({ number, etag }) => ({ PartNumber: number, ETag: etag }))
        }
      }));
    },
    async abortMultipartUpload({ storageKey, uploadId }) {
      await client.send(new AbortMultipartUploadCommand({
        Bucket: config.bucket,
        Key: storageKey,
        UploadId: uploadId
      }));
    }
  };
}
