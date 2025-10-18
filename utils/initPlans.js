// scripts/initPlans.js
import mongoose from 'mongoose';
import SubscriptionPlan from '../models/SubscriptionPlanModel.js';
import dotenv from 'dotenv';

dotenv.config();

const initPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const plans = [
      {
        name: 'basic',
        displayName: 'Starter Plan',
        description: 'Perfect for beginners starting with AI prompts',
        isFree: true,
        pricing: { 
          USD: { monthly: 0, yearly: 0 }, 
          NGN: { monthly: 0, yearly: 0 } 
        },
        tier: 1,
        levelRequired: 'Newbie',
        limits: {
          promptsLimit: 20,
          apiCallsLimit: 100,
          storageLimit: 100,
          maxImageSize: 5,
          maxImagesPerPrompt: 5,
          maxCommunities: 2,
          canCreatePrivate: true,
          canExport: false,
          maxPromptLength: 1000,
        },
        features: [
          { name: 'Create Public Prompts', included: true },
          { name: 'Join Communities', included: true },
          { name: 'Image Uploads', included: true },
          { name: 'Private Prompts', included: true },
          { name: 'Export Features', included: false }
        ],
        isActive: true
      },
      {
        name: 'standard',
        displayName: 'Creator Plan',
        description: 'For content creators and regular users',
        isFree: false,
        pricing: { 
          USD: { monthly: 999, yearly: 9999 }, 
          NGN: { monthly: 14985, yearly: 149850 } 
        },
        tier: 2,
        levelRequired: 'Contributor',
        limits: {
          promptsLimit: 100,
          apiCallsLimit: 1000,
          storageLimit: 1024,
          maxImageSize: 10,
          maxImagesPerPrompt: 10,
          maxCommunities: 5,
          canCreatePrivate: true,
          canExport: true,
          maxPromptLength: 5000,
        },
        features: [
          { name: 'Create Public Prompts', included: true },
          { name: 'Join Communities', included: true },
          { name: 'Image Uploads', included: true },
          { name: 'Private Prompts', included: true },
          { name: 'Export Features', included: true }
        ],
        isActive: true
      },
      {
        name: 'premium',
        displayName: 'Pro Plan',
        description: 'For professionals and power users',
        isFree: false,
        pricing: { 
          USD: { monthly: 1999, yearly: 19999 }, 
          NGN: { monthly: 29985, yearly: 299850 } 
        },
        tier: 3,
        levelRequired: 'Pro',
        limits: {
          promptsLimit: -1,
          apiCallsLimit: 10000,
          storageLimit: 5120,
          maxImageSize: 20,
          maxImagesPerPrompt: 20,
          maxCommunities: -1,
          canCreatePrivate: true,
          canExport: true,
          maxPromptLength: 10000,
        },
        features: [
          { name: 'Create Public Prompts', included: true },
          { name: 'Join Communities', included: true },
          { name: 'Image Uploads', included: true },
          { name: 'Private Prompts', included: true },
          { name: 'Export Features', included: true }
        ],
        isActive: true
      }
    ];

    for (const planData of plans) {
      const existingPlan = await SubscriptionPlan.findOne({ name: planData.name });
      
      if (existingPlan) {
        await SubscriptionPlan.findByIdAndUpdate(existingPlan._id, planData);
      } else {
        await SubscriptionPlan.create(planData);
      }
    }

    
    // Verify the plans were created
    const allPlans = await SubscriptionPlan.find();    
    process.exit(0);
  } catch (error) {
    console.error('Error initializing plans:', error);
    process.exit(1);
  }
};

initPlans();