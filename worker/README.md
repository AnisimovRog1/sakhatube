# SakhaTube media worker

This is a **private, non-public** processing service. It turns one API-created
`incoming/.../source.*` object into a real HLS rendition, and writes the
result back through Postgres directly (not through the public API). It is not
a web server, does not create public links, and never changes a source into a
viewer-facing object by itself — only an explicitly verified, fully-uploaded
rendition can do that.

## What it guarantees

- Queue messages are validated before download: UUIDs, exact API source-key
  shape, allowlisted MIME types, and a 50 GiB limit (`src/contract.mjs`).
- `ffprobe` JSON is validated before `ffmpeg` may run: video stream, duration,
  and safe dimensions.
- Video is always re-encoded to H.264 `yuv420p` regardless of the source's
  chroma sampling — 4:2:2/4:4:4 sources are common from professional cameras
  and screen recorders but most players/devices cannot decode them.
- A rendition cannot become `ready` until its manifest, every segment, and the
  poster have been uploaded privately and independently re-fetched and
  verified (`verifyOutput()` in `src/adapter.mjs`) — including a check that no
  manifest contains an absolute or root-relative URI.
- HLS keys are internal `renditions/<release-id>/...`; the API gateway
  (`server/app.js`) continues to authorize every manifest/segment request. Do
  not add public bucket ACLs, static website hosting, or raw source routes.

## Architecture

```
src/contract.mjs    job/probe validation, rendition planning (pure, no I/O)
src/runner.mjs      processJob() — orchestrates the contract above; unchanged
                     integration boundary, see the comment at its top
src/ffmpeg.mjs       ffmpeg/ffprobe process spawning, HLS encode, master
                     playlist text, gateway-safety check
src/storage.mjs      minimal S3-compatible client (download/upload/verify)
src/store.mjs        minimal Postgres client (create/update media_assets)
src/api-client.mjs   HTTP client for the worker-only claim/settle API
src/adapter.mjs      wires all of the above into the shape processJob() needs
src/service.mjs      the actual long-running process: polls claim, runs
                     processJob(), settles succeeded/retryable/permanent
```

`store.mjs` and `storage.mjs` are **deliberately self-contained duplicates**
of small pieces of `server/postgres-store.js` / `server/media-store.js`, not
imports — this directory is built and deployed on its own (see `Dockerfile`),
so it cannot depend on files outside it. If the `media_assets` column mapping
ever changes on the API side, mirror the change here.

## Running it locally

```sh
cd worker
npm install
npm test                 # pure-logic + fake-adapter tests, no real infra needed

# Full loop against a real (local!) Postgres + S3-compatible bucket:
SAKHATUBE_API_URL=http://127.0.0.1:3333 \
MEDIA_WORKER_TOKEN=<same value the API has as MEDIA_WORKER_TOKEN> \
DATABASE_URL=postgresql://... \
S3_ENDPOINT=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... S3_BUCKET=... \
npm start
```

No system `ffmpeg`/`ffprobe` install is required for local development: set
`FFMPEG_PATH`/`FFPROBE_PATH` to point at `node_modules/ffmpeg-static/ffmpeg`
and `node_modules/ffprobe-static/bin/<platform>/<arch>/ffprobe` (both are
devDependencies here). The container never sets these — it uses the
apt-installed system binaries on `PATH` instead (see `Dockerfile`).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `SAKHATUBE_API_URL` | yes | Base URL of the main API service (the claim/settle endpoints) |
| `MEDIA_WORKER_TOKEN` | yes | Must equal the API's `MEDIA_WORKER_TOKEN` |
| `DATABASE_URL` | yes | Same Postgres as the API. The worker never runs migrations — the API owns schema |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` | yes | Same bucket the API uploads sources to |
| `S3_REGION` | no | Defaults to `auto` |
| `WORKER_ID` | no | Defaults to `worker-<pid>`; set something stable per instance for readable logs |
| `WORKER_POLL_INTERVAL_MS` | no | Defaults to `8000` |
| `FFMPEG_PATH`, `FFPROBE_PATH` | no | Local dev only — see above |

## Deploying

Deploy this directory as its **own** Railway service (root directory =
`worker/`, Dockerfile builder), separate from the main API and Postgres
services already in the project. Give it `DATABASE_URL` (reference the same
Postgres service) and the same S3/`MEDIA_WORKER_TOKEN` values as the API. It
binds no port and needs no public domain.

Before trusting it with real user uploads, still add: a durable queue/dead-
letter policy beyond the current attempt-count column, metrics/alerts,
malware scanning of the source before transcode, and a restore test. None of
that exists yet.

## Job contract

```json
{
  "jobId": "uuid", "sourceAssetId": "uuid", "contentId": "uuid",
  "sourceKey": "incoming/2026-07-16/<sourceAssetId>/source.mp4",
  "contentType": "video/mp4", "sizeBytes": 1048576, "attempt": 1
}
```

Jobs are only created after the API marks `media_assets.status = queued`. The
claim endpoint leases a job atomically (`SELECT ... FOR UPDATE SKIP LOCKED`
server-side) so two worker instances never process the same job concurrently.

## Local contract + service tests

```sh
cd worker
npm test
```

`test/contract.test.mjs` covers the pure validation/planning logic.
`test/ffmpeg.test.mjs` covers master-playlist generation and the gateway-
safety check. `test/service.test.mjs` drives the poll/settle loop against a
fake API and a fake adapter (success, permanent failure, retryable failure,
incomplete output, transport errors) — no real ffmpeg/S3/Postgres needed.
None of this exercises a real encode; that was verified manually end-to-end
(real ffmpeg, a throwaway local Postgres + MinIO, and a real fetch through the
API's playback gateway) before this was considered done.
