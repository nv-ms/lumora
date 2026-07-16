const express = require('express');
const healthController = require('../controllers/health.controller');

const router = express.Router();

router.get('/health', healthController.health);
router.get('/catalog', healthController.catalog);
router.get('/media-cache', healthController.cacheStats);
router.post('/media-cache/limit', healthController.cacheLimit);
router.post('/media-cache/clear', healthController.cacheClear);

module.exports = router;
