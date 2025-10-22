
import mongoose from 'mongoose';

const RewardSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rewardType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RewardType',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  message: {
    type: String,
    maxlength: 200
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  medal: {
    name: String,
    tier: String,
    color: String,
    icon: String
  }
}, {
  timestamps: true
});

const TrendSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 300
  },
  content: {
    type: String,
    required: true,
    maxlength: 40000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true
  },
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  voteScore: {
    type: Number,
    default: 0
  },
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  commentCount: {
    type: Number,
    default: 0
  },
  rewards: [RewardSchema],
  totalRewardValue: {
    type: Number,
    default: 0
  },
  rewardCount: {
    type: Number,
    default: 0
  },
  medalSummary: {
    gold: { type: Number, default: 0 },
    silver: { type: Number, default: 0 },
    bronze: { type: Number, default: 0 },
    platinum: { type: Number, default: 0 },
    diamond: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  topRewards: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: Number,
    medal: String
  }],
  featuredMedals: [{
    rewardType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardType'
    },
    count: Number,
    lastGiven: Date
  }],
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  lastRewardAt: Date,
  rewardStreak: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});


    
TrendSchema.pre('save', function(next) {
  if (this.isModified('rewards')) {
    this.medalSummary = { gold: 0, silver: 0, bronze: 0, platinum: 0, diamond: 0, other: 0 };
    this.totalRewardValue = 0;
    this.rewardCount = this.rewards.length;
    
    // Calculate medal counts and total value
    this.rewards.forEach(reward => {
      this.totalRewardValue += reward.amount;
      
      // Count medals by name
      const medalName = reward.medal?.name?.toLowerCase() || 'other';
      if (this.medalSummary.hasOwnProperty(medalName)) {
        this.medalSummary[medalName] += 1;
      } else {
        this.medalSummary.other += 1;
      }
    });
    
    // Update top rewards
    const rewardMap = new Map();
    this.rewards.forEach(reward => {
      const key = reward.user.toString();
      const current = rewardMap.get(key) || { amount: 0, medal: '' };
      rewardMap.set(key, {
        amount: current.amount + reward.amount,
        medal: reward.amount > current.amount ? reward.medal?.name : current.medal
      });
    });
    
    this.topRewards = Array.from(rewardMap.entries())
      .map(([user, data]) => ({ 
        user, 
        amount: data.amount,
        medal: data.medal
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
      
    // Update featured medals (most given medals)
    const medalCount = {};
    this.rewards.forEach(reward => {
      const medalId = reward.rewardType.toString();
      medalCount[medalId] = (medalCount[medalId] || 0) + 1;
    });
    
    this.featuredMedals = Object.entries(medalCount)
      .map(([rewardType, count]) => ({ rewardType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }
  next();
});

export default mongoose.model('Trend', TrendSchema);