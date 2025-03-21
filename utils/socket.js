
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = (io) => {
  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });
  
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username}`);
    
    // Join user to their personal room
    socket.join(socket.user._id.toString());
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username}`);
    });
  });
  
  // Function to emit notification to a user
  const emitNotification = (userId, notification) => {
    io.to(userId.toString()).emit('notification', notification);
  };
  
  // Function to emit tweet to followers
  const emitTweetToFollowers = (followers, tweet) => {
    followers.forEach(followerId => {
      io.to(followerId.toString()).emit('new_tweet', tweet);
    });
  };
  
  return {
    emitNotification,
    emitTweetToFollowers
  };
};
