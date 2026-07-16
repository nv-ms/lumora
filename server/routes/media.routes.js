const express = require('express');
const mediaController = require('../controllers/media.controller');

const router = express.Router();

router.get('/files', mediaController.files);
router.post('/upload', mediaController.upload);
router.get('/folders', mediaController.folders);
router.get('/fs/roots', mediaController.roots);
router.get('/fs/list', mediaController.listFs);
router.get('/media/:id/playback', mediaController.playback);
router.post('/media/:id/playback', mediaController.playback);
router.get('/media/:id/playback/:renditionId', mediaController.playbackState);
router.get('/media/:id/renditions/:renditionId/:fileName', mediaController.renditionAsset);
router.get('/media/:id/embedded-subtitles/:streamIndex.vtt', mediaController.embeddedSubtitle);
router.get('/media/:id', mediaController.stream);
router.head('/media/:id', mediaController.stream);

module.exports = router;
