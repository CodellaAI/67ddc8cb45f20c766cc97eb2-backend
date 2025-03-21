
const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  getUserTweets,
  followUser,
  unfollowUser,
  updateUserProfile,
  getSuggestedUsers,
  searchUsers
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { uploadProfileImage, uploadCoverImage } = require('../middleware/uploadMiddleware');

// Get user profile by username
router.get('/:username', getUserProfile);

// Get user tweets by username
router.get('/:username/tweets', getUserTweets);

// Follow a user
router.post('/:id/follow', authenticateToken, followUser);

// Unfollow a user
router.post('/:id/unfollow', authenticateToken, unfollowUser);

// Update user profile
router.put('/profile', authenticateToken, updateUserProfile);

// Get suggested users to follow
router.get('/suggestions', authenticateToken, getSuggestedUsers);

// Search users
router.get('/search', searchUsers);

module.exports = router;
