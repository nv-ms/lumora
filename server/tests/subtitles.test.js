const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const dbModel = require('../models/db');
const catalogService = require('../services/catalog.service');
const subtitleService = require('../services/subtitles.service');

const write = async (filePath) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '1\n00:00:00,000 --> 00:00:01,000\nTest\n', 'utf8');
};

test('matches subtitle folders by episode without leaking tracks from other episodes', async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lumora-subtitles-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const mediaDir = path.join(root, 'videos');
    const subtitleDir = path.join(root, 'subtitles');
    const mediaPath = path.join(mediaDir, 'Show.S01E02.mkv');
    await write(mediaPath);
    await write(path.join(subtitleDir, 'S01E01', 'English.srt'));
    await write(path.join(subtitleDir, 'S01E02', 'English.srt'));
    await write(path.join(subtitleDir, 'S01E02', 'French.srt'));

    const originalMedia = catalogService.media;
    const originalLibrary = dbModel.getLibrary;
    catalogService.media = async () => ({ path: mediaPath });
    dbModel.getLibrary = async () => ({
        movies: [],
        series: [{
            id: 'series-1',
            subtitles: [],
            seasons: [{
                number: 1,
                subtitles: [subtitleDir],
                episodes: [{ id: 'episode-2', number: 2, season: 1, filePath: mediaPath, subtitles: [] }]
            }]
        }]
    });
    t.after(() => {
        catalogService.media = originalMedia;
        dbModel.getLibrary = originalLibrary;
    });

    const tracks = await subtitleService.list('episode-2');
    assert.deepEqual(tracks.map((track) => track.fileName).sort(), ['English.srt', 'French.srt']);
    assert.ok(tracks.every((track) => track.path.includes(`${path.sep}S01E02${path.sep}`)));
});

test('includes every track in a folder selected for one episode', async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lumora-subtitles-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const mediaPath = path.join(root, 'videos', 'Episode.mkv');
    const subtitleDir = path.join(root, 'episode-subtitles');
    await write(mediaPath);
    for (let index = 1; index <= 20; index += 1) {
        await write(path.join(subtitleDir, `Track.${index}.srt`));
    }

    const originalMedia = catalogService.media;
    const originalLibrary = dbModel.getLibrary;
    catalogService.media = async () => ({ path: mediaPath });
    dbModel.getLibrary = async () => ({
        movies: [],
        series: [{
            id: 'series-1',
            subtitles: [],
            seasons: [{
                number: 1,
                subtitles: [],
                episodes: [{ id: 'episode-1', number: 1, season: 1, filePath: mediaPath, subtitles: [subtitleDir] }]
            }]
        }]
    });
    t.after(() => {
        catalogService.media = originalMedia;
        dbModel.getLibrary = originalLibrary;
    });

    const tracks = await subtitleService.list('episode-1');
    assert.equal(tracks.length, 20);
});
