# SakhaTube media worker (foundation)

This is a **private, non-public** processing service. It turns one API-created
`incoming/.../source.*` object into a separate HLS rendition plan. It is not a
web server, does not create public links, and never changes a source into a
viewer-facing object.

## What it guarantees

- Queue messages are validated before download: UUIDs, exact API source-key
  shape, allowlisted MIME types, and a 50 GiB limit.
- `ffprobe` JSON is validated before `ffmpeg` may run: video stream, duration,
  and safe dimensions.
- A rendition cannot become `ready` until its manifest, segments and poster
  have been uploaded privately and `verifyOutput()` returns `true`.
- HLS keys are internal `renditions/<release-id>/...`; API gateway continues to
  authorize every manifest/segment request. Do not add public bucket ACLs,
  static website hosting, or raw source routes.

## Job contract

```json
{
  "jobId": "uuid", "sourceAssetId": "uuid", "contentId": "uuid",
  "sourceKey": "incoming/2026-07-16/<sourceAssetId>/source.mp4",
  "contentType": "video/mp4", "sizeBytes": 1048576, "attempt": 1
}
```

Jobs must only be created after the API marks `media_assets.status = queued`.
The adapter must claim a job atomically and make duplicate delivery idempotent
by `jobId`/`sourceAssetId`.

## Required adapter operations

Pass `processJob()` private implementations of:

- `getSource(key)` → `{ localPath, sizeBytes, isPublic: false }`;
- `run(binary, args)` → `{ exitCode, stdout }`, without a shell;
- `transcode({source, plan, probe})` → creates HLS with relative URIs in a
  sandboxed temporary directory, uploads every output using `Cache-Control:
  private, no-store`;
- `verifyOutput(plan)` → verifies all master/variant manifests, every segment
  and poster exist as private objects and contain no absolute/root-relative URI;
- `createMedia(asset)` and `markSource(id, patch)` → Postgres store calls in
  one transactional/idempotent adapter.

Use command arrays (never `exec`/shell strings), write only into a unique
non-symlink temp directory, cap CPU/time/disk, virus-scan source before
transcode, and delete local source/output in `finally`.

## Local contract tests

```sh
cd worker
npm test
```

## Container

`Dockerfile` contains ffmpeg and no listening port. Deploy it as a separate
worker service with private object-storage credentials and a queue consumer.
Before connecting it to production, add a durable queue/dead-letter policy,
metrics/alerts, malware scanning, transactional job claim, and a restore test.
