
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getCurrentUser,
  refreshUserToken,
  logoutUser
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Register a new user
router.post('/register', registerUser);

// Login user
router.post('/login', loginUser);

// Get current user
router.get('/me', authenticateToken, getCurrentUser);

// Refresh token
router.post('/refresh-token', refreshUserToken);

// Logout user
router.post('/logout', authenticateToken, logoutUser);

module.exports = router;
