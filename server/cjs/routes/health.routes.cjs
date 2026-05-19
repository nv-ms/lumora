const express = require('express');
const controller = require('../controllers/core.controller.cjs');

const router = express.Router();

router.get('/health', controller.health);
router.get('/catalog', controller.getCatalog);

module.exports = router;
