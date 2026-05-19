const express = require('express');
const mediaController = require('../controllers/media.controller');

const router = express.Router();

router.get('/files', mediaController.files);
router.post('/upload', mediaController.upload);
router.get('/folders', mediaController.folders);
router.get('/fs/roots', mediaController.roots);
router.get('/fs/list', mediaController.listFs);
router.get('/media/:id', mediaController.stream);

module.exports = router;
