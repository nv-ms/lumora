const path = require('node:path');
const dbModel = require('../models/db');
const utilService = require('./util.service');

const seriesService = {
    autoCatalog: async (seriesId, sourceFolder) => {
        const fs = require('node:fs/promises');
        const files = [];

        const walk = async (dir) => {
            let entries = [];
            try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) await walk(fullPath);
                if (entry.isFile() && utilService.videoExts.has(path.extname(fullPath).toLowerCase())) files.push(fullPath);
            }
        };

        await walk(sourceFolder);

        const created = [];
        for (const filePath of files) {
            const parsed = utilService.parseEpisode(path.basename(filePath));
            const season = parsed?.season ?? 1;
            const episodeNumber = parsed?.episode ?? 0;
            const title = path.basename(filePath, path.extname(filePath)).replace(/[._]/g, ' ').trim();

            await dbModel.addSeason(seriesId, season);
            const seasonResult = await dbModel.addEpisode(seriesId, season, { title, filePath, episodeNumber, subtitles: [] });
            const episode = seasonResult.episodes.find((entry) => entry.filePath === filePath);
            if (episode) created.push(episode);
        }

        return created;
    }
};

module.exports = seriesService;
