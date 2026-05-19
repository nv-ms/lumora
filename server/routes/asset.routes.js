const express = require('express');
const assetController = require('../controllers/asset.controller');

const router = express.Router();

router.get('/thumbnail/:id', assetController.thumbGet);
router.post('/thumbnail/:id', assetController.thumbSet);
router.get('/subtitles/:mediaId', assetController.subtitlesGet);
router.get('/subtitles/:mediaId/:trackId', assetController.subtitleTrack);

module.exports = router;
