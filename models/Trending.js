
const mongoose = require('mongoose');

const trendingSchema = new mongoose.Schema({
  tag: {
    type: String,
    required: true,
    unique: true
  },
  count: {
    type: Number,
    default: 1
  },
  category: {
    type: String,
    default: 'Trending'
  },
  tweets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tweet'
  }]
}, {
  timestamps: true
});

// Index for efficient sorting
trendingSchema.index({ count: -1 });

const Trending = mongoose.model('Trending', trendingSchema);

module.exports = Trending;
