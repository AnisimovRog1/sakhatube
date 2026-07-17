import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMasterPlaylist, manifestIsGatewaySafe } from '../src/ffmpeg.mjs';

test('master playlist references variants by relative path only, with an advisory bandwidth/resolution per rendition', () => {
  const renditions = [{ height: 360 }, { height: 720 }];
  const text = buildMasterPlaylist(renditions, 1280, 720);
  assert.match(text, /^#EXTM3U/);
  assert.match(text, /#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\nv360\/index\.m3u8/);
  assert.match(text, /#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720\nv720\/index\.m3u8/);
  assert.equal(text.includes('http'), false);
});

test('gateway safety check mirrors server/app.js: relative HLS only', () => {
  assert.equal(manifestIsGatewaySafe('#EXTM3U\nv360/index.m3u8\n'), true);
  assert.equal(manifestIsGatewaySafe('not a manifest'), false);
  assert.equal(manifestIsGatewaySafe('#EXTM3U\nhttps://evil.example/index.m3u8\n'), false);
  assert.equal(manifestIsGatewaySafe('#EXTM3U\n/absolute/index.m3u8\n'), false);
  assert.equal(manifestIsGatewaySafe('#EXTM3U\n#EXT-X-KEY:URI="/absolute/key"\n'), false);
});
