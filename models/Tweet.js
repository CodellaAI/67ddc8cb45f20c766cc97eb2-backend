
const mongoose = require('mongoose');

const tweetSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Tweet text is required'],
    trim: true,
    maxlength: [280, 'Tweet cannot be more than 280 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  imageUrl: {
    type: String
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  retweets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tweet'
  }],
  parentTweet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tweet'
  },
  isRetweet: {
    type: Boolean,
    default: false
  },
  isReply: {
    type: Boolean,
    default: false
  },
  originalTweet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tweet'
  },
  hashtags: [{
    type: String
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for like count
tweetSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for retweet count
tweetSchema.virtual('retweetCount').get(function() {
  return this.retweets.length;
});

// Virtual for reply count
tweetSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

// Pre-save middleware to extract hashtags and mentions
tweetSchema.pre('save', function(next) {
  // Extract hashtags
  const hashtagRegex = /#(\w+)/g;
  const hashtags = [];
  let match;
  
  while ((match = hashtagRegex.exec(this.text)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  
  this.hashtags = [...new Set(hashtags)]; // Remove duplicates
  
  next();
});

// Index for efficient searching
tweetSchema.index({ text: 'text', hashtags: 1 });
tweetSchema.index({ author: 1, createdAt: -1 });
tweetSchema.index({ createdAt: -1 });

const Tweet = mongoose.model('Tweet', tweetSchema);

module.exports = Tweet;
