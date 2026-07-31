const test = require('node:test');
const assert = require('node:assert/strict');
const dbModel = require('../models/db');
const libraryController = require('../controllers/library.controller');

test('clamps playback progress and clears the resume point at completion', async (t) => {
    const original = dbModel.setPlayback;
    let saved;
    dbModel.setPlayback = async (_id, playback) => { saved = playback; return playback; };
    t.after(() => { dbModel.setPlayback = original; });

    let response;
    await libraryController.savePlayback(
        { params: { id: 'episode-test' }, body: { currentTime: 101, duration: 100, progress: 1.01 } },
        { status: () => ({ json: (value) => { response = value; } }) },
        (error) => { throw error; }
    );

    assert.deepEqual(saved, { progress: 1, currentTime: 0, duration: 100 });
    assert.deepEqual(response, { playback: saved });
});
