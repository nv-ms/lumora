const express = require('express');
const controller = require('../controllers/media.controller.cjs');

const router = express.Router();

router.get('/files', controller.getFiles);
router.post('/upload', controller.uploadFile);
router.get('/folders', controller.getFolders);
router.get('/fs/roots', controller.getFsRoots);
router.get('/fs/list', controller.getFsList);
router.get('/media/:id', controller.streamMedia);

module.exports = router;
