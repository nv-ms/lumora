const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../services/playback-policy.service');

const metadata = (patch = {}) => ({
    containers: ['mov', 'mp4'], duration: 60,
    video: { codec: 'h264', profile: 'High', level: 41, pixelFormat: 'yuv420p', width: 1920, height: 1080, colorTransfer: 'bt709', dolbyVision: false },
    audio: [{ index: 1, codec: 'aac', profile: 'LC', channels: 2, default: true }, { index: 2, codec: 'ac3', profile: '', channels: 6, default: false }],
    ...patch
});

test('selects the source default audio and direct play for safe MP4', () => {
    const result = policy.evaluate(metadata());
    assert.equal(result.method, 'direct'); assert.equal(result.audio.index, 1);
});

test('remuxes safe streams from another container', () => assert.equal(policy.evaluate(metadata({ containers: ['matroska'] })).method, 'remux'));
test('creates a selected-track rendition', () => assert.equal(policy.evaluate(metadata(), 2).method, 'audio-transcode'));
test('fully transcodes HDR and oversized video', () => {
    assert.equal(policy.evaluate(metadata({ video: { ...metadata().video, codec: 'hevc', pixelFormat: 'yuv420p10le', colorTransfer: 'smpte2084', hdr: true } })).method, 'full-transcode');
    assert.equal(policy.evaluate(metadata({ video: { ...metadata().video, width: 3840, height: 2160 } })).method, 'full-transcode');
});
test('rejects missing video and invalid audio selection', () => {
    assert.equal(policy.evaluate(metadata({ video: null })).reason, 'missing_video');
    assert.equal(policy.evaluate(metadata(), 99).reason, 'audio_stream_not_found');
});
