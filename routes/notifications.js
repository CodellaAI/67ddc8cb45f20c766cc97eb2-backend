
const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
} = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get user notifications
router.get('/', authenticateToken, getNotifications);

// Mark notification as read
router.put('/:id/read', authenticateToken, markAsRead);

// Mark all notifications as read
router.put('/read-all', authenticateToken, markAllAsRead);

// Get unread notification count
router.get('/unread-count', authenticateToken, getUnreadCount);

module.exports = router;
