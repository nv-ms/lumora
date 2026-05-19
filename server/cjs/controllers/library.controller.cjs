const path = require('node:path');
const { getModules } = require('../services/esm-bridge.cjs');

async function getSources(req, res, next) {
  try {
    const { db } = await getModules();
    const data = await db.readDb();
    res.status(200).json({ sources: data.sources });
  } catch (error) { next(error); }
}

async function addSource(req, res, next) {
  try {
    const { db } = await getModules();
    if (!req.body.path || typeof req.body.path !== 'string') return res.status(400).json({ error: 'path is required' });
    const data = await db.readDb();
    const sources = await db.setSources([...data.sources, req.body.path]);
    res.status(200).json({ sources });
  } catch (error) { next(error); }
}

async function deleteSource(req, res, next) {
  try {
    const { db } = await getModules();
    const data = await db.readDb();
    const sources = await db.setSources(data.sources.filter((entry) => entry !== req.body.path));
    res.status(200).json({ sources });
  } catch (error) { next(error); }
}

async function createMovie(req, res, next) {
  try {
    const { db } = await getModules();
    const body = req.body || {};
    if (!body.title || !body.filePath) return res.status(400).json({ error: 'title and filePath are required' });
    const movie = await db.createMovie({
      title: body.title,
      filePath: body.filePath,
      subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
      thumbnailPath: body.thumbnailPath || '',
      trailerPath: body.trailerPath || '',
    });
    res.status(200).json({ movie });
  } catch (error) { next(error); }
}

async function updateMovie(req, res, next) {
  try {
    const { db } = await getModules();
    const movie = await db.updateMovie(req.params.movieId, req.body || {});
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.status(200).json({ movie });
  } catch (error) { next(error); }
}

async function deleteMovie(req, res, next) {
  try {
    const { db } = await getModules();
    const ok = await db.deleteMovie(req.params.movieId);
    res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Movie not found' });
  } catch (error) { next(error); }
}

async function createSeries(req, res, next) {
  try {
    const { db, mediaUtils, seriesService } = await getModules();
    const body = req.body || {};
    if (!body.title) return res.status(400).json({ error: 'title is required' });
    const series = await db.createSeries({
      title: body.title,
      sourceFolder: body.sourceFolder || '',
      subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
      thumbnailPath: body.thumbnailPath || '',
      trailerPath: body.trailerPath || '',
    });

    let previewEpisodes = [];
    if (Array.isArray(body.episodeFiles) && body.episodeFiles.length) {
      for (const ep of body.episodeFiles) {
        const parsed = mediaUtils.parseEpisode(path.basename(ep.filePath));
        const season = Number(ep.seasonNumber || parsed?.season || 1);
        const number = Number(ep.episodeNumber || parsed?.episode || 0);
        await db.addSeason(series.id, season);
        const seasonResult = await db.addEpisode(series.id, season, {
          title: ep.title || path.basename(ep.filePath, path.extname(ep.filePath)),
          filePath: ep.filePath,
          episodeNumber: number,
          subtitles: Array.isArray(ep.subtitles) ? ep.subtitles : [],
          thumbnailPath: ep.thumbnailPath || '',
          trailerPath: ep.trailerPath || '',
        });
        const added = seasonResult.episodes.find((entry) => entry.filePath === ep.filePath);
        if (added) previewEpisodes.push(added);
      }
    } else if (body.autoCatalog && body.sourceFolder) {
      previewEpisodes = await seriesService.autoCatalogSeriesEpisodes(series.id, body.sourceFolder);
    }

    res.status(200).json({ series, previewEpisodes });
  } catch (error) { next(error); }
}

async function updateSeries(req, res, next) {
  try {
    const { db } = await getModules();
    const series = await db.updateSeries(req.params.seriesId, req.body || {});
    if (!series) return res.status(404).json({ error: 'Series not found' });
    res.status(200).json({ series });
  } catch (error) { next(error); }
}

async function deleteSeries(req, res, next) {
  try {
    const { db } = await getModules();
    const ok = await db.deleteSeries(req.params.seriesId);
    res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Series not found' });
  } catch (error) { next(error); }
}

async function createSeason(req, res, next) {
  try {
    const { db } = await getModules();
    const seasonNumber = Number(req.body?.seasonNumber);
    if (!seasonNumber) return res.status(400).json({ error: 'seasonNumber is required' });
    const series = await db.addSeason(req.params.seriesId, seasonNumber);
    if (!series) return res.status(404).json({ error: 'Series not found' });
    res.status(200).json({ series });
  } catch (error) { next(error); }
}

async function createEpisode(req, res, next) {
  try {
    const { db } = await getModules();
    const body = req.body || {};
    if (!body.title || !body.filePath) return res.status(400).json({ error: 'title and filePath are required' });
    const season = await db.addEpisode(req.params.seriesId, Number(req.params.seasonNumber), {
      title: body.title,
      filePath: body.filePath,
      episodeNumber: Number(body.episodeNumber || 0),
      subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
      thumbnailPath: body.thumbnailPath || '',
      trailerPath: body.trailerPath || '',
    });
    if (!season) return res.status(404).json({ error: 'Series not found' });
    res.status(200).json({ season });
  } catch (error) { next(error); }
}

async function savePlayback(req, res, next) {
  try {
    const { db } = await getModules();
    const body = req.body || {};
    const playback = await db.updatePlayback(req.params.id, {
      progress: Number(body.progress || 0),
      currentTime: Number(body.currentTime || 0),
      duration: Number(body.duration || 0),
    });
    res.status(200).json({ playback });
  } catch (error) { next(error); }
}

module.exports = { getSources, addSource, deleteSource, createMovie, updateMovie, deleteMovie, createSeries, updateSeries, deleteSeries, createSeason, createEpisode, savePlayback };
