
const express = require('express');
const router = express.Router();
const {
  createTweet,
  getTimeline,
  getTrendingTweets,
  getTweetById,
  likeTweet,
  retweetTweet,
  replyToTweet,
  getTweetReplies,
  deleteTweet,
  searchTweets
} = require('../controllers/tweetController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { uploadTweetImage } = require('../middleware/uploadMiddleware');

// Create a new tweet
router.post('/', authenticateToken, uploadTweetImage, createTweet);

// Get home timeline
router.get('/timeline', authenticateToken, getTimeline);

// Get trending tweets
router.get('/trending', getTrendingTweets);

// Get tweet by ID
router.get('/:id', getTweetById);

// Like a tweet
router.post('/:id/like', authenticateToken, likeTweet);

// Retweet a tweet
router.post('/:id/retweet', authenticateToken, retweetTweet);

// Reply to a tweet
router.post('/:id/reply', authenticateToken, replyToTweet);

// Get tweet replies
router.get('/:id/replies', getTweetReplies);

// Delete a tweet
router.delete('/:id', authenticateToken, deleteTweet);

// Search tweets
router.get('/search', searchTweets);

module.exports = router;
