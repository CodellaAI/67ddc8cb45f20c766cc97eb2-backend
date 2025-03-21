
const Tweet = require('../models/Tweet');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Trending = require('../models/Trending');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

// @desc    Create a new tweet
// @route   POST /api/tweets
// @access  Private
const createTweet = async (req, res, next) => {
  try {
    const { text } = req.body;
    
    if (!text && !req.file) {
      return res.status(400).json({ message: 'Tweet text or image is required' });
    }
    
    let imageUrl = null;
    
    // Upload image if provided
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url;
    }
    
    // Create tweet
    const tweet = await Tweet.create({
      text: text || '',
      author: req.user._id,
      imageUrl
    });
    
    // Populate author details
    const populatedTweet = await Tweet.findById(tweet._id)
      .populate('author', '_id name username profileImageUrl isVerified');
    
    // Process hashtags for trending
    if (tweet.hashtags.length > 0) {
      for (const tag of tweet.hashtags) {
        // Update or create trending entry
        await Trending.findOneAndUpdate(
          { tag },
          { 
            $inc: { count: 1 },
            $push: { tweets: tweet._id }
          },
          { upsert: true, new: true }
        );
      }
    }
    
    // Process mentions for notifications
    const mentionRegex = /@(\w+)/g;
    let match;
    const mentionedUsernames = [];
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentionedUsernames.push(match[1]);
    }
    
    if (mentionedUsernames.length > 0) {
      const mentionedUsers = await User.find({
        username: { $in: mentionedUsernames }
      });
      
      // Create notifications for mentioned users
      for (const user of mentionedUsers) {
        if (user._id.toString() !== req.user._id.toString()) {
          await Notification.create({
            recipient: user._id,
            sender: req.user._id,
            type: 'mention',
            tweet: tweet._id
          });
        }
      }
    }
    
    res.status(201).json({
      _id: populatedTweet._id,
      text: populatedTweet.text,
      author: populatedTweet.author,
      imageUrl: populatedTweet.imageUrl,
      createdAt: populatedTweet.createdAt,
      likes: 0,
      retweets: 0,
      replies: 0,
      isLiked: false,
      isRetweeted: false
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get home timeline
// @route   GET /api/tweets/timeline
// @access  Private
const getTimeline = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Get users that the current user is following
    const user = await User.findById(req.user._id);
    const following = [...user.following, req.user._id]; // Include user's own tweets
    
    // Get tweets from followed users
    const tweets = await Tweet.find({
      $or: [
        { author: { $in: following } },
        { retweets: { $in: following } }
      ]
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
      const isLiked = tweet.likes.includes(req.user._id);
      const isRetweeted = tweet.retweets.includes(req.user._id);
      
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

// @desc    Get trending tweets
// @route   GET /api/tweets/trending
// @access  Public
const getTrendingTweets = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Get tweets with most likes and retweets
    const tweets = await Tweet.aggregate([
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $size: '$likes' },
              { $size: '$retweets' },
              { $size: '$replies' }
            ]
          }
        }
      },
      { $sort: { engagementScore: -1, createdAt: -1 } },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) }
    ]);
    
    // Populate author details
    const populatedTweets = await Tweet.populate(tweets, {
      path: 'author',
      select: '_id name username profileImageUrl isVerified'
    });
    
    // Add additional fields for frontend
    const tweetsWithMeta = populatedTweets.map(tweet => {
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
        isRetweeted
      };
    });
    
    res.json(tweetsWithMeta);
  } catch (error) {
    next(error);
  }
};

// @desc    Get tweet by ID
// @route   GET /api/tweets/:id
// @access  Public
const getTweetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tweet = await Tweet.findById(id)
      .populate('author', '_id name username profileImageUrl isVerified')
      .populate({
        path: 'originalTweet',
        populate: {
          path: 'author',
          select: '_id name username profileImageUrl isVerified'
        }
      });
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Add additional fields for frontend
    const isLiked = req.user ? 
      tweet.likes.includes(req.user._id) : 
      false;
    
    const isRetweeted = req.user ? 
      tweet.retweets.includes(req.user._id) : 
      false;
    
    const tweetWithMeta = {
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
    
    res.json(tweetWithMeta);
  } catch (error) {
    next(error);
  }
};

// @desc    Like a tweet
// @route   POST /api/tweets/:id/like
// @access  Private
const likeTweet = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tweet = await Tweet.findById(id);
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Check if already liked
    const alreadyLiked = tweet.likes.includes(req.user._id);
    
    if (alreadyLiked) {
      // Unlike
      tweet.likes = tweet.likes.filter(
        userId => userId.toString() !== req.user._id.toString()
      );
    } else {
      // Like
      tweet.likes.push(req.user._id);
      
      // Create notification (only if not liking own tweet)
      if (tweet.author.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: tweet.author,
          sender: req.user._id,
          type: 'like',
          tweet: tweet._id
        });
      }
    }
    
    await tweet.save();
    
    res.json({
      message: alreadyLiked ? 'Tweet unliked' : 'Tweet liked',
      likes: tweet.likes.length,
      isLiked: !alreadyLiked
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Retweet a tweet
// @route   POST /api/tweets/:id/retweet
// @access  Private
const retweetTweet = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tweet = await Tweet.findById(id);
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Check if already retweeted
    const alreadyRetweeted = tweet.retweets.includes(req.user._id);
    
    if (alreadyRetweeted) {
      // Undo retweet
      tweet.retweets = tweet.retweets.filter(
        userId => userId.toString() !== req.user._id.toString()
      );
      
      // Delete the retweet
      await Tweet.deleteOne({
        isRetweet: true,
        originalTweet: tweet._id,
        author: req.user._id
      });
    } else {
      // Retweet
      tweet.retweets.push(req.user._id);
      
      // Create a retweet tweet
      await Tweet.create({
        author: req.user._id,
        isRetweet: true,
        originalTweet: tweet._id,
        text: tweet.text
      });
      
      // Create notification (only if not retweeting own tweet)
      if (tweet.author.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: tweet.author,
          sender: req.user._id,
          type: 'retweet',
          tweet: tweet._id
        });
      }
    }
    
    await tweet.save();
    
    res.json({
      message: alreadyRetweeted ? 'Retweet undone' : 'Tweet retweeted',
      retweets: tweet.retweets.length,
      isRetweeted: !alreadyRetweeted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to a tweet
// @route   POST /api/tweets/:id/reply
// @access  Private
const replyToTweet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ message: 'Reply text is required' });
    }
    
    const parentTweet = await Tweet.findById(id);
    
    if (!parentTweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Create reply tweet
    const replyTweet = await Tweet.create({
      text,
      author: req.user._id,
      isReply: true,
      parentTweet: parentTweet._id
    });
    
    // Add reply to parent tweet
    parentTweet.replies.push(replyTweet._id);
    await parentTweet.save();
    
    // Populate author details
    const populatedReply = await Tweet.findById(replyTweet._id)
      .populate('author', '_id name username profileImageUrl isVerified');
    
    // Create notification (only if not replying to own tweet)
    if (parentTweet.author.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: parentTweet.author,
        sender: req.user._id,
        type: 'reply',
        tweet: parentTweet._id
      });
    }
    
    res.status(201).json({
      _id: populatedReply._id,
      text: populatedReply.text,
      author: populatedReply.author,
      createdAt: populatedReply.createdAt,
      likes: 0,
      retweets: 0,
      replies: 0,
      isLiked: false,
      isRetweeted: false,
      isReply: true,
      parentTweet: parentTweet._id
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get tweet replies
// @route   GET /api/tweets/:id/replies
// @access  Public
const getTweetReplies = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const tweet = await Tweet.findById(id);
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    const replies = await Tweet.find({
      parentTweet: tweet._id,
      isReply: true
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('author', '_id name username profileImageUrl isVerified');
    
    // Add additional fields for frontend
    const repliesWithMeta = replies.map(reply => {
      const isLiked = req.user ? 
        reply.likes.includes(req.user._id) : 
        false;
      
      const isRetweeted = req.user ? 
        reply.retweets.includes(req.user._id) : 
        false;
      
      return {
        _id: reply._id,
        text: reply.text,
        author: reply.author,
        imageUrl: reply.imageUrl,
        createdAt: reply.createdAt,
        likes: reply.likes.length,
        retweets: reply.retweets.length,
        replies: reply.replies.length,
        isLiked,
        isRetweeted,
        isReply: true,
        parentTweet: reply.parentTweet
      };
    });
    
    res.json(repliesWithMeta);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a tweet
// @route   DELETE /api/tweets/:id
// @access  Private
const deleteTweet = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tweet = await Tweet.findById(id);
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Check if user is author
    if (tweet.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this tweet' });
    }
    
    // If tweet has an image, delete from cloudinary
    if (tweet.imageUrl) {
      const publicId = tweet.imageUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`chirp-social/tweets/${publicId}`);
    }
    
    // Remove tweet from parent's replies if it's a reply
    if (tweet.isReply && tweet.parentTweet) {
      await Tweet.findByIdAndUpdate(tweet.parentTweet, {
        $pull: { replies: tweet._id }
      });
    }
    
    // Remove tweet from original's retweets if it's a retweet
    if (tweet.isRetweet && tweet.originalTweet) {
      await Tweet.findByIdAndUpdate(tweet.originalTweet, {
        $pull: { retweets: req.user._id }
      });
    }
    
    // Delete related notifications
    await Notification.deleteMany({ tweet: tweet._id });
    
    // Delete the tweet
    await tweet.remove();
    
    res.json({ message: 'Tweet deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Search tweets
// @route   GET /api/tweets/search
// @access  Public
const searchTweets = async (req, res, next) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Search tweets by text or hashtags
    const tweets = await Tweet.find({
      $or: [
        { text: { $regex: query, $options: 'i' } },
        { hashtags: { $in: [query.replace('#', '').toLowerCase()] } }
      ]
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('author', '_id name username profileImageUrl isVerified');
    
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
        isRetweeted
      };
    });
    
    res.json(tweetsWithMeta);
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
