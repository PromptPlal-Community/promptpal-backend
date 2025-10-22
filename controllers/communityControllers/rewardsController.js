import Trend from '../../models/commmunity/trendsModel'
import User from '../../models/userModel'
import RewardType from '../../models/commmunity/RewardType'


// Add medal reward to trend
export const handleAddMedalReward = async (req, res) => {
  try {
    const { rewardTypeId, message, isAnonymous } = req.body;
    const trendId = req.params.id;
    const userId = req.user.id;

    // Get reward type
    const rewardType = await RewardType.findById(rewardTypeId);
    if (!rewardType || !rewardType.isActive) {
        return res.status(400).json({
            success: false,
            message: 'Invalid reward type'
        });
    }

    const trend = await Trend.findById(trendId);
    if (!trend) {
        return res.status(404).json({
            success: false,
            message: 'Trend not found'
        });
    }

    // Check if user is rewarding their own trend
    if (trend.author.toString() === userId) {
        return res.status(400).json({
            success: false,
            message: 'Cannot reward your own trend'
        });
    }

    const user = await User.findById(userId);

    // Check daily limit for this reward type
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRewards = trend.rewards.filter(reward => 
      reward.user.toString() === userId &&
      reward.rewardType.toString() === rewardTypeId &&
      reward.createdAt >= today
    );

    if (rewardType.dailyLimit && todayRewards.length >= rewardType.dailyLimit) {
      return res.status(400).json({ 
        success: false,
        message: `Daily limit reached for ${rewardType.displayName}` 
      });
    }

    // Check cooldown
    const lastReward = todayRewards[todayRewards.length - 1];
    if (lastReward && rewardType.cooldown > 0) {
      const cooldownTime = new Date(lastReward.createdAt.getTime() + rewardType.cooldown * 60000);
      if (new Date() < cooldownTime) {
        return res.status(400).json({
        success: false,
        message: `Please wait ${rewardType.cooldown} minutes before giving another ${rewardType.displayName}`
        });
      }
    }

    // Check if user has enough points
    if (user.rewardPoints < rewardType.value) {
      return res.status(400).json({ 
        success: false,
        message: `Insufficient points. Need ${rewardType.value} but have ${user.rewardPoints}` 
      });
    }

    // Create reward object with medal data
    const reward = {
      user: userId,
      rewardType: rewardTypeId,
      amount: rewardType.value,
      message: message || '',
      isAnonymous: isAnonymous || false,
      medal: {
        name: rewardType.name,
        tier: rewardType.tier,
        color: rewardType.color,
        icon: rewardType.icon
      }
    };

    // Add reward to trend
    trend.rewards.push(reward);
    trend.lastRewardAt = new Date();
    
    await trend.save();

    // Update user points and history
    user.rewardPoints -= rewardType.value;
    user.totalRewardsGiven += rewardType.value;
    user.rewardHistory.push({
      trend: trendId,
      amount: rewardType.value,
      type: 'given',
      rewardType: rewardTypeId,
      date: new Date()
    });

    await user.save();

    // Update trend author's points and history
    const trendAuthor = await User.findById(trend.author);
    trendAuthor.rewardPoints += rewardType.value;
    trendAuthor.totalRewardsReceived += rewardType.value;
    trendAuthor.rewardHistory.push({
      trend: trendId,
      amount: rewardType.value,
      type: 'received',
      rewardType: rewardTypeId,
      date: new Date()
    });

    await trendAuthor.save();

    // Populate the trend for response
    const populatedTrend = await Trend.findById(trendId)
      .populate('rewards.user', 'username avatar')
      .populate('rewards.rewardType')
      .populate('topRewards.user', 'username avatar')
      .populate('featuredMedals.rewardType');

    res.status(201).json({
        success: true,
        message: `${rewardType.displayName} awarded successfully!`,
      reward: {
        ...reward,
        rewardType: rewardType
      },
      trend: populatedTrend,
      userPoints: user.rewardPoints
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get available reward types
export const handleGetRewardsTypes = async (req, res) => {
  try {
    const rewardTypes = await RewardType.find({ isActive: true })
      .sort({ value: -1, tier: -1 });

    res.json(rewardTypes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get trend reward summary
export const handleGetTrendRewardSummary = async (req, res) => {
  try {
    const trend = await Trend.findById(req.params.id)
      .populate('rewards.user', 'username avatar')
      .populate('rewards.rewardType')
      .populate('featuredMedals.rewardType')
      .select('rewards medalSummary totalRewardValue rewardCount featuredMedals topRewards');

    if (!trend) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    // Group rewards by type for detailed breakdown
    const rewardBreakdown = {};
    trend.rewards.forEach(reward => {
      const typeName = reward.rewardType.name;
      if (!rewardBreakdown[typeName]) {
        rewardBreakdown[typeName] = {
          count: 0,
          totalValue: 0,
          rewardType: reward.rewardType
        };
      }
      rewardBreakdown[typeName].count += 1;
      rewardBreakdown[typeName].totalValue += reward.amount;
    });

    res.json({
      summary: trend.medalSummary,
      totalValue: trend.totalRewardValue,
      totalCount: trend.rewardCount,
      breakdown: rewardBreakdown,
      featuredMedals: trend.featuredMedals,
      topContributors: trend.topRewards
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user's reward statistics with medals
export const handleGetUserRewardStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('rewardPoints totalRewardsGiven totalRewardsReceived rewardTier rewardHistory username avatar')
      .populate('rewardHistory.trend', 'title')
      .populate('rewardHistory.rewardType');

    // Calculate medal counts
    const medalStats = {
      given: {},
      received: {}
    };

    user.rewardHistory.forEach(record => {
      const stats = medalStats[record.type];
      const medalName = record.rewardType?.name || 'unknown';
      
      if (!stats[medalName]) {
        stats[medalName] = {
          count: 0,
          totalValue: 0,
          rewardType: record.rewardType
        };
      }
      
      stats[medalName].count += 1;
      stats[medalName].totalValue += record.amount;
    });

    const stats = {
      user: {
        username: user.username,
        avatar: user.avatar,
        tier: user.rewardTier
      },
      points: user.rewardPoints,
      totalGiven: user.totalRewardsGiven,
      totalReceived: user.totalRewardsReceived,
      medalStats,
      recentHistory: user.rewardHistory.slice(-10).reverse()
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get leaderboards with medals
export const handleLeaderboards = async (req, res) => {
  try {
    const type = req.query.type || 'received';
    const medalType = req.query.medal;
    const limit = parseInt(req.query.limit) || 20;

    let aggregationPipeline = [
      {
        $match: {
          totalRewardsReceived: { $gt: 0 }
        }
      },
      {
        $project: {
          username: 1,
          avatar: 1,
          rewardTier: 1,
          totalRewardsReceived: 1,
          totalRewardsGiven: 1,
          rewardHistory: 1
        }
      }
    ];

    if (medalType) {
      // Filter by specific medal type
      aggregationPipeline[0].$match['rewardHistory.rewardType.name'] = medalType;
    }

    aggregationPipeline.push({ $sort: { totalRewardsReceived: -1 } });
    aggregationPipeline.push({ $limit: limit });

    const leaderboard = await User.aggregate(aggregationPipeline);

    // Enhance with medal details
    const enhancedLeaderboard = await Promise.all(
      leaderboard.map(async (user) => {
        const userDoc = await User.findById(user._id)
          .populate('rewardHistory.rewardType');
        
        const medalCounts = {};
        userDoc.rewardHistory.forEach(record => {
          if (record.type === type) {
            const medalName = record.rewardType?.name || 'unknown';
            medalCounts[medalName] = (medalCounts[medalName] || 0) + 1;
          }
        });

        return {
          ...user,
          medalCounts,
          topMedal: Object.entries(medalCounts)
            .sort(([,a], [,b]) => b - a)[0] || ['none', 0]
        };
      })
    );

    res.json({
      leaderboard: enhancedLeaderboard,
      type,
      medalType,
      updatedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};