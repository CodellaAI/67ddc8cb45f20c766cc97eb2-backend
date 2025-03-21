
const User = require('../models/User');
const Tweet = require('../models/Tweet');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

// @desc    Get user profile by username
// @route   GET /api/users/:username
// @access  Public
const getUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    
    const user = await User.findOne({ username })
      .select('-refreshToken -__v')
      .populate('followers', '_id name username profileImageUrl')
      .populate('following', '_id name username profileImageUrl');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Count user's tweets
    const tweetCount = await Tweet.countDocuments({ 
      author: user._id,
      isRetweet: false,
      isReply: false
    });
    
    // Check if the requesting user is following this user
    let isFollowing = false;
    if (req.user) {
      isFollowing = user.followers.some(
        follower => follower._id.toString() === req.user._id.toString()
      );
    }
    
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      location: user.location,
      website: user.website,
      profileImageUrl: user.profileImageUrl,
      coverImageUrl: user.coverImageUrl,
      isVerified: user.isVerified,
      followers: user.followers.length,
      following: user.following.length,
      tweetCount,
      isFollowing,
      createdAt: user.createdAt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user tweets by username
// @route   GET /api/users/:username/tweets
// @access  Public
const getUserTweets = async (req, res, next) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const tweets = await Tweet.find({
      author: user._id,
      isReply: false
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('author', '_id name username profileImageUrl isVerified')
      .populate({
        path: 'originalTweet',
        populate: {
          path: 'author',
          select: '_id name username profileImageUrl isVerified'
        }
      });
    
    // Add additional fields for frontend
    const tweetsWithMeta = tweets.map(tweet => {
      const isLiked = req.user ? 
        tweet.likes.includes(req.user._id) : 
        false;
      
      const isRetweeted = req.user ? 
        tweet.retweets.includes(req.user._id) : 
        false;
      
      return {
        _id: tweet._id,
        text: tweet.text,
        author: tweet.author,
        imageUrl: tweet.imageUrl,
        createdAt: tweet.createdAt,
        likes: tweet.likes.length,
        retweets: tweet.retweets.length,
        replies: tweet.replies.length,
        isLiked,
        isRetweeted,
        isRetweet: tweet.isRetweet,
        originalTweet: tweet.originalTweet
      };
    });
    
    res.json(tweetsWithMeta);
  } catch (error) {
    next(error);
  }
};

// @desc    Follow a user
// @route   POST /api/users/:id/follow
// @access  Private
const followUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const userToFollow = await User.findById(id);
    
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is trying to follow themselves
    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }
    
    // Check if already following
    if (userToFollow.followers.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are already following this user' });
    }
    
    // Add current user to followers of target user
    userToFollow.followers.push(req.user._id);
    await userToFollow.save();
    
    // Add target user to following of current user
    const currentUser = await User.findById(req.user._id);
    currentUser.following.push(userToFollow._id);
    await currentUser.save();
    
    // Create notification
    await Notification.create({
      recipient: userToFollow._id,
      sender: req.user._id,
      type: 'follow'
    });
    
    res.json({ message: 'User followed successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Unfollow a user
// @route   POST /api/users/:id/unfollow
// @access  Private
const unfollowUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const userToUnfollow = await User.findById(id);
    
    if (!userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is trying to unfollow themselves
    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: 'You cannot unfollow yourself' });
    }
    
    // Check if not following
    if (!userToUnfollow.followers.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are not following this user' });
    }
    
    // Remove current user from followers of target user
    userToUnfollow.followers = userToUnfollow.followers.filter(
      follower => follower.toString() !== req.user._id.toString()
    );
    await userToUnfollow.save();
    
    // Remove target user from following of current user
    const currentUser = await User.findById(req.user._id);
    currentUser.following = currentUser.following.filter(
      following => following.toString() !== userToUnfollow._id.toString()
    );
    await currentUser.save();
    
    res.json({ message: 'User unfollowed successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res, next) => {
  try {
    const { name, bio, location, website } = req.body;
    
    // Find user
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user fields
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    
    // Handle profile image upload
    if (req.files && req.files.profileImage) {
      // Upload to cloudinary
      const result = await cloudinary.uploader.upload(req.files.profileImage.path);
      user.profileImageUrl = result.secure_url;
    }
    
    // Handle cover image upload
    if (req.files && req.files.coverImage) {
      // Upload to cloudinary
      const result = await cloudinary.uploader.upload(req.files.coverImage.path);
      user.coverImageUrl = result.secure_url;
    }
    
    // Save updated user
    await user.save();
    
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      location: user.location,
      website: user.website,
      profileImageUrl: user.profileImageUrl,
      coverImageUrl: user.coverImageUrl,
      isVerified: user.isVerified
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get suggested users to follow
// @route   GET /api/users/suggestions
// @access  Private
const getSuggestedUsers = async (req, res, next) => {
  try {
    const { limit = 3 } = req.query;
    
    // Get users that the current user is not following
    const currentUser = await User.findById(req.user._id);
    
    const suggestions = await User.find({
      _id: { 
        $nin: [
          req.user._id, 
          ...currentUser.following
        ] 
      }
    })
      .select('_id name username profileImageUrl bio isVerified')
      .limit(Number(limit));
    
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
};

// @desc    Search users
// @route   GET /api/users/search
// @access  Public
const searchUsers = async (req, res, next) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } }
      ]
    })
      .select('_id name username profileImageUrl bio isVerified')
      .skip((page - 1) * limit)
      .limit(Number(limit));
    
    res.json(users);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
  getUserTweets,
  followUser,
  unfollowUser,
  updateUserProfile,
  getSuggestedUsers,
  searchUsers
};
