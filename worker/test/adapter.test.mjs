import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdapter } from '../src/adapter.mjs';

// verifyOutput() was previously entirely untested at this layer -- the
// existing service.test.mjs tests only ever mock verifyOutput as a plain
// true/false function, never exercise the real manifest-reading and
// segment-checking logic in adapter.mjs against a (fake) storage backend.

const plan = {
  prefix: 'renditions/release-1/',
  manifestKey: 'renditions/release-1/master.m3u8',
  posterKey: 'renditions/release-1/poster.jpg',
  renditions: [{ height: 360, playlistKey: 'renditions/release-1/v360/index.m3u8' }]
};

const masterText = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=600000\nv360/index.m3u8\n';
const variantText = '#EXTM3U\n#EXTINF:4,\nsegment-001.ts\n';

function fakeStorage({ segmentSize = 1000, posterSize = 500 } = {}) {
  const texts = { [plan.manifestKey]: masterText, [plan.renditions[0].playlistKey]: variantText };
  const sizes = { 'renditions/release-1/v360/segment-001.ts': segmentSize, [plan.posterKey]: posterSize };
  return {
    async readText(key) {
      if (!(key in texts)) throw new Error('object missing');
      return texts[key];
    },
    async objectSize(key) {
      return key in sizes ? sizes[key] : null;
    },
    async objectExists(key) {
      return key in texts || key in sizes;
    }
  };
}

test('verifyOutput accepts a manifest whose segments and poster are all present and non-empty', async () => {
  const adapter = createAdapter({ storage: fakeStorage(), store: {} });
  assert.equal(await adapter.verifyOutput(plan), true);
});

test('verifyOutput rejects a zero-byte segment even though the object exists', async () => {
  const adapter = createAdapter({ storage: fakeStorage({ segmentSize: 0 }), store: {} });
  assert.equal(await adapter.verifyOutput(plan), false);
});

test('verifyOutput rejects a zero-byte poster even though the object exists', async () => {
  const adapter = createAdapter({ storage: fakeStorage({ posterSize: 0 }), store: {} });
  assert.equal(await adapter.verifyOutput(plan), false);
});

test('verifyOutput rejects a missing segment', async () => {
  const storage = fakeStorage();
  storage.objectSize = async () => null;
  const adapter = createAdapter({ storage, store: {} });
  assert.equal(await adapter.verifyOutput(plan), false);
});
