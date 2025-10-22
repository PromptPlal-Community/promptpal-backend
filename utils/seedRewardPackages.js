const mongoose = require('mongoose');
const RewardPackage = require('../models/RewardPackage');

const predefinedPackages = [
  {
    name: 'Starter Pack',
    description: 'Perfect for getting started with rewarding',
    points: 100,
    price: 500, // 500 NGN
    bonus: 10,
    currency: 'NGN',
    features: ['100 medal points', '10 bonus points'],
    order: 1,
    popular: false
  },
  {
    name: 'Community Pack',
    description: 'Great for active community members',
    points: 500,
    price: 2000, // 2000 NGN
    bonus: 75,
    currency: 'NGN',
    features: ['500 medal points', '75 bonus points', 'Better value'],
    order: 2,
    popular: true
  },
  {
    name: 'Power User',
    description: 'For serious trend setters and rewarders',
    points: 1200,
    price: 4000, // 4000 NGN
    bonus: 200,
    currency: 'NGN',
    features: ['1200 medal points', '200 bonus points', 'Best value'],
    order: 3,
    popular: false
  },
  {
    name: 'Elite Pack',
    description: 'Maximum points for top contributors',
    points: 3000,
    price: 9000, // 9000 NGN
    bonus: 600,
    currency: 'NGN',
    features: ['3000 medal points', '600 bonus points', 'Elite status'],
    order: 4,
    popular: false
  }
];

async function seedRewardPackages() {
  try {
    for (const packageData of predefinedPackages) {
      await RewardPackage.findOneAndUpdate(
        { name: packageData.name },
        packageData,
        { upsert: true, new: true }
      );
    }
    console.log('Reward packages seeded successfully');
  } catch (error) {
    console.error('Error seeding reward packages:', error);
  }
}

module.exports = seedRewardPackages;