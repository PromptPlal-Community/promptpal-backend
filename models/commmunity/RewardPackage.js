import mongoose from "mongoose";

const RewardType = require('../models/RewardType');

const predefinedRewards = [
  // Gold Tier
  {
    name: 'gold',
    displayName: 'Gold Medal',
    tier: 'legendary',
    value: 100,
    color: '#FFD700',
    icon: '🥇',
    description: 'Exceptional content that stands out',
    dailyLimit: 3,
    cooldown: 60
  },
  {
    name: 'platinum',
    displayName: 'Platinum Medal',
    tier: 'legendary',
    value: 200,
    color: '#E5E4E2',
    icon: '💎',
    description: 'Once-in-a-lifetime amazing content',
    dailyLimit: 1,
    cooldown: 1440
  },

  // Silver Tier
  {
    name: 'silver',
    displayName: 'Silver Medal',
    tier: 'epic',
    value: 50,
    color: '#C0C0C0',
    icon: '🥈',
    description: 'High quality and valuable content',
    dailyLimit: 10,
    cooldown: 30
  },
  {
    name: 'diamond',
    displayName: 'Diamond Award',
    tier: 'epic',
    value: 75,
    color: '#B9F2FF',
    icon: '🔷',
    description: 'Brilliant and insightful content',
    dailyLimit: 5,
    cooldown: 120
  },

  // Bronze Tier
  {
    name: 'bronze',
    displayName: 'Bronze Medal',
    tier: 'rare',
    value: 25,
    color: '#CD7F32',
    icon: '🥉',
    description: 'Good effort and solid content',
    dailyLimit: 20,
    cooldown: 15
  },
  {
    name: 'copper',
    displayName: 'Copper Star',
    tier: 'rare',
    value: 15,
    color: '#B87333',
    icon: '🔶',
    description: 'Appreciated contribution',
    dailyLimit: 30,
    cooldown: 10
  },

  // Common Tier
  {
    name: 'applause',
    displayName: 'Round of Applause',
    tier: 'common',
    value: 5,
    color: '#10B981',
    icon: '👏',
    description: 'Well done!',
    dailyLimit: 50,
    cooldown: 5
  },
  {
    name: 'thanks',
    displayName: 'Thank You',
    tier: 'common',
    value: 2,
    color: '#3B82F6',
    icon: '🙏',
    description: 'Simple appreciation',
    dailyLimit: 100,
    cooldown: 2
  },
  {
    name: 'creative',
    displayName: 'Creative Spark',
    tier: 'common',
    value: 8,
    color: '#8B5CF6',
    icon: '✨',
    description: 'Creative and original thinking',
    dailyLimit: 25,
    cooldown: 10
  },
  {
    name: 'helpful',
    displayName: 'Helpful Hand',
    tier: 'common',
    value: 6,
    color: '#06B6D4',
    icon: '🤝',
    description: 'Very helpful and informative',
    dailyLimit: 40,
    cooldown: 8
  }
];

async function seedRewardTypes() {
  try {
    for (const rewardData of predefinedRewards) {
      await RewardType.findOneAndUpdate(
        { name: rewardData.name },
        rewardData,
        { upsert: true, new: true }
      );
    }
    console.log('Reward types seeded successfully');
  } catch (error) {
    console.error('Error seeding reward types:', error);
  }
}

export default mongoose.model('RewardPackage', rewardPackageSchema);