const express = require('express');
const libraryController = require('../controllers/library.controller');

const router = express.Router();

router.get('/sources', libraryController.getSources);
router.post('/sources/add', libraryController.addSource);
router.post('/sources/delete', libraryController.deleteSource);
router.post('/library/movie', libraryController.createMovie);
router.post('/library/movie/:movieId/update', libraryController.updateMovie);
router.post('/library/movie/:movieId/delete', libraryController.deleteMovie);
router.post('/library/series', libraryController.createSeries);
router.post('/library/series/:seriesId/update', libraryController.updateSeries);
router.post('/library/series/:seriesId/delete', libraryController.deleteSeries);
router.post('/library/series/:seriesId/season', libraryController.createSeason);
router.post('/library/series/:seriesId/season/:seasonNumber/episode', libraryController.createEpisode);
router.post('/playback/:id', libraryController.savePlayback);

module.exports = router;