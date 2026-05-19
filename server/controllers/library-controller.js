import { readJsonBody, sendJson } from "../services/http-service.js";
import { dbModel } from "../models/db-model.js";
import { autoCatalogSeriesEpisodes } from "../services/series-service.js";
import { parseEpisode } from "../services/media-utils-service.js";
import path from "node:path";

export async function getSources({ res }) {
  const db = await dbModel.readDb();
  return sendJson(res, 200, { sources: db.sources });
}

export async function addSource({ req, res }) {
  const body = await readJsonBody(req);
  if (!body.path || typeof body.path !== "string") return sendJson(res, 400, { error: "path is required" });
  const db = await dbModel.readDb();
  const sources = await dbModel.setSources([...db.sources, body.path]);
  return sendJson(res, 200, { sources });
}

export async function deleteSource({ req, res }) {
  const body = await readJsonBody(req);
  const target = body.path;
  const db = await dbModel.readDb();
  const sources = await dbModel.setSources(db.sources.filter((entry) => entry !== target));
  return sendJson(res, 200, { sources });
}

export async function createMovieEntry({ req, res }) {
  const body = await readJsonBody(req);
  if (!body.title || !body.filePath) return sendJson(res, 400, { error: "title and filePath are required" });
  const movie = await dbModel.createMovie({
    title: body.title,
    filePath: body.filePath,
    subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
    thumbnailPath: body.thumbnailPath || "",
    trailerPath: body.trailerPath || "",
  });
  return sendJson(res, 200, { movie });
}

export async function patchMovie({ req, res, params }) {
  const movie = await dbModel.updateMovie(params.movieId, await readJsonBody(req));
  if (!movie) return sendJson(res, 404, { error: "Movie not found" });
  return sendJson(res, 200, { movie });
}

export async function removeMovie({ res, params }) {
  const ok = await dbModel.deleteMovie(params.movieId);
  return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: "Movie not found" });
}

export async function createSeriesEntry({ req, res }) {
  const body = await readJsonBody(req);
  if (!body.title) return sendJson(res, 400, { error: "title is required" });
  const series = await dbModel.createSeries({
    title: body.title,
    sourceFolder: body.sourceFolder || "",
    subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
    thumbnailPath: body.thumbnailPath || "",
    trailerPath: body.trailerPath || "",
  });

  let previewEpisodes = [];
  if (Array.isArray(body.episodeFiles) && body.episodeFiles.length) {
    for (const ep of body.episodeFiles) {
      const parsed = parseEpisode(path.basename(ep.filePath));
      const season = Number(ep.seasonNumber || parsed?.season || 1);
      const number = Number(ep.episodeNumber || parsed?.episode || 0);
      await dbModel.addSeason(series.id, season);
      const seasonResult = await dbModel.addEpisode(series.id, season, {
        title: ep.title || path.basename(ep.filePath, path.extname(ep.filePath)),
        filePath: ep.filePath,
        episodeNumber: number,
        subtitles: Array.isArray(ep.subtitles) ? ep.subtitles : [],
        thumbnailPath: ep.thumbnailPath || "",
        trailerPath: ep.trailerPath || "",
      });
      const added = seasonResult.episodes.find((entry) => entry.filePath === ep.filePath);
      if (added) previewEpisodes.push(added);
    }
  } else if (body.autoCatalog && body.sourceFolder) {
    previewEpisodes = await autoCatalogSeriesEpisodes(series.id, body.sourceFolder);
  }

  return sendJson(res, 200, { series, previewEpisodes });
}

export async function patchSeries({ req, res, params }) {
  const series = await dbModel.updateSeries(params.seriesId, await readJsonBody(req));
  if (!series) return sendJson(res, 404, { error: "Series not found" });
  return sendJson(res, 200, { series });
}

export async function removeSeries({ res, params }) {
  const ok = await dbModel.deleteSeries(params.seriesId);
  return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: "Series not found" });
}

export async function createSeason({ req, res, params }) {
  const seasonNumber = Number((await readJsonBody(req)).seasonNumber);
  if (!seasonNumber) return sendJson(res, 400, { error: "seasonNumber is required" });
  const show = await dbModel.addSeason(params.seriesId, seasonNumber);
  if (!show) return sendJson(res, 404, { error: "Series not found" });
  return sendJson(res, 200, { series: show });
}

export async function createEpisode({ req, res, params }) {
  const body = await readJsonBody(req);
  if (!body.title || !body.filePath) return sendJson(res, 400, { error: "title and filePath are required" });
  const season = await dbModel.addEpisode(params.seriesId, Number(params.seasonNumber), {
    title: body.title,
    filePath: body.filePath,
    episodeNumber: Number(body.episodeNumber || 0),
    subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
    thumbnailPath: body.thumbnailPath || "",
    trailerPath: body.trailerPath || "",
  });
  if (!season) return sendJson(res, 404, { error: "Series not found" });
  return sendJson(res, 200, { season });
}

export async function patchPlayback({ req, res, params }) {
  const body = await readJsonBody(req);
  const playback = await dbModel.updatePlayback(params.id, {
    progress: Number(body.progress || 0),
    currentTime: Number(body.currentTime || 0),
    duration: Number(body.duration || 0),
  });
  return sendJson(res, 200, { playback });
}
