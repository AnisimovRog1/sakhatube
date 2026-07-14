import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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
    async get(storageKey) {
      return client.send(new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    },
    async remove(storageKey) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    }
  };
}
