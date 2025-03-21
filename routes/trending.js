
const express = require('express');
const router = express.Router();
const { getTrendingTopics } = require('../controllers/trendingController');

// Get trending topics
router.get('/', getTrendingTopics);

module.exports = router;
