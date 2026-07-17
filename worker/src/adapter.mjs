import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProcess, transcodeVariant, extractPoster, buildMasterPlaylist, manifestIsGatewaySafe, ffprobeBinary } from './ffmpeg.mjs';

// runner.mjs's processJob() only ever calls deps.run('ffprobe', args) — it
// knows nothing about a FFPROBE_PATH override, so this adapter resolves that
// one logical name to the binary ffmpeg.mjs was configured with. ffmpeg itself
// is invoked directly by transcodeVariant()/extractPoster() below, never
// through deps.run(), so there is nothing else for this to resolve.
const resolveBinary = (binary) => (binary === 'ffprobe' ? ffprobeBinary : binary);

// Wires the processJob() contract (see ../src/runner.mjs and ../README.md) to
// real object storage, real ffmpeg, and a real Postgres connection. Nothing
// here ever returns or logs a public URL.
export function createAdapter({ storage, store }) {
  // processJob() downloads the source via getSource() and only reaches
  // transcode() — the one place that used to clean it up — after ffprobe
  // validation succeeds. A malformed/corrupt upload (bad duration, no video
  // stream, ffprobe failure) throws before transcode() ever runs, leaking the
  // downloaded source directory. Tracked here so service.mjs can sweep
  // whatever transcode() didn't get to, after every job attempt.
  const pendingSourceDirs = new Set();

  return {
    async getSource(key) {
      const dir = await mkdtemp(join(tmpdir(), 'sakhatube-src-'));
      pendingSourceDirs.add(dir);
      const localPath = join(dir, 'source');
      const sizeBytes = await storage.downloadToFile(key, localPath);
      return { localPath, sizeBytes, isPublic: false, tempDir: dir };
    },

    async cleanupPending() {
      await Promise.all([...pendingSourceDirs].map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
      pendingSourceDirs.clear();
    },

    // Only ever invoked by processJob() for the ffprobe validation step.
    run: (binary, args) => runProcess(resolveBinary(binary), args),

    async transcode({ source, plan, probe }) {
      const workDir = await mkdtemp(join(tmpdir(), 'sakhatube-out-'));
      try {
        for (const rendition of plan.renditions) {
          const variantDir = join(workDir, `v${rendition.height}`);
          await mkdir(variantDir, { recursive: true });
          await transcodeVariant({ sourcePath: source.localPath, height: rendition.height, hasAudio: probe.hasAudio, outputDir: variantDir });
          for (const file of await readdir(variantDir)) {
            const contentType = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
            await storage.uploadFile(`${plan.prefix}v${rendition.height}/${file}`, join(variantDir, file), contentType);
          }
        }
        const posterPath = join(workDir, 'poster.jpg');
        await extractPoster({ sourcePath: source.localPath, destPath: posterPath, atSeconds: Math.min(1, probe.durationMs / 2000) });
        await storage.uploadFile(plan.posterKey, posterPath, 'image/jpeg');
        const masterPath = join(workDir, 'master.m3u8');
        await writeFile(masterPath, buildMasterPlaylist(plan.renditions, probe.width, probe.height), 'utf8');
        await storage.uploadFile(plan.manifestKey, masterPath, 'application/vnd.apple.mpegurl');
      } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
        await rm(source.tempDir, { recursive: true, force: true }).catch(() => {});
        pendingSourceDirs.delete(source.tempDir);
      }
    },

    async verifyOutput(plan) {
      const masterText = await storage.readText(plan.manifestKey).catch(() => null);
      if (!masterText || !manifestIsGatewaySafe(masterText)) return false;
      for (const rendition of plan.renditions) {
        const variantText = await storage.readText(rendition.playlistKey).catch(() => null);
        if (!variantText || !manifestIsGatewaySafe(variantText)) return false;
        const segments = variantText.split('\n').filter((line) => line && !line.startsWith('#'));
        if (!segments.length) return false;
        const variantPrefix = rendition.playlistKey.slice(0, rendition.playlistKey.lastIndexOf('/') + 1);
        for (const segment of segments) {
          if (segment.startsWith('/') || segment.includes('://')) return false;
          if (!(await storage.objectExists(`${variantPrefix}${segment}`))) return false;
        }
      }
      return storage.objectExists(plan.posterKey);
    },

    createMedia: (asset) => store.createMedia(asset),
    markSource: (id, patch) => store.updateMedia(id, patch)
  };
}
