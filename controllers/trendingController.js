
const Trending = require('../models/Trending');

// @desc    Get trending topics
// @route   GET /api/trending
// @access  Public
const getTrendingTopics = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;
    
    const trendingTopics = await Trending.find()
      .sort({ count: -1 })
      .limit(Number(limit));
    
    // Format for frontend
    const formattedTopics = trendingTopics.map((topic, index) => ({
      id: topic._id,
      name: `#${topic.tag}`,
      category: topic.category,
      tweetCount: topic.count,
      rank: index + 1
    }));
    
    res.json(formattedTopics);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTrendingTopics
};
