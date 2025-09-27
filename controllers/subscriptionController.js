
import User from '../models/userModel.js';
import SubscriptionPlan from '../models/SubscriptionPlanModel.js';

// Get available plans
export const getAvailablePlans = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const currency = user.currencyPreference;
    
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ tier: 1 });
    const supportedGateways = PaymentGatewayFactory.getSupportedGateways(currency);
    
    const formattedPlans = plans.map(plan => {
      const planObj = plan.toObject();
      const pricing = plan.pricing[currency];
      
      return {
        ...planObj,
        pricing: {
          monthly: pricing.monthly,
          yearly: pricing.yearly,
          formatted: plan.formattedPricing[currency]
        },
        supportedGateways: supportedGateways.map(gateway => ({
          name: gateway,
          displayName: PaymentGatewayFactory.getGatewayDisplayName(gateway)
        })),
        currency
      };
    });

    res.json(formattedPlans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Free basic plan
export const activateFreePlan = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Check if user already has an active subscription
    if (user.subscription.status === 'active' || user.subscription.status === 'trial') {
      return res.status(400).json({ 
        error: 'You already have an active subscription' 
      });
    }

    const freePlan = await SubscriptionPlan.findOne({ name: 'basic', isFree: true });
    
    if (!freePlan) {
      return res.status(404).json({ error: 'Free plan not available' });
    }

    // Check if user level meets plan requirement
    const userLevelIndex = ['Newbie', 'Contributor', 'Pro', 'Expert'].indexOf(user.level);
    const requiredLevelIndex = ['Newbie', 'Contributor', 'Pro', 'Expert'].indexOf(freePlan.levelRequired);
    
    if (userLevelIndex < requiredLevelIndex) {
      return res.status(400).json({ 
        error: `Your level (${user.level}) is insufficient for this plan. Required: ${freePlan.levelRequired}` 
      });
    }

    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 30);

    user.subscription = {
      planId: freePlan._id,
      status: 'trial',
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnds,
      trialEndsAt: trialEnds
    };

    // Reset usage for new subscription
    user.usage = {
      promptsCreated: user.usage.promptsCreated,
      promptsThisMonth: 0,
      apiCalls: 0,
      storageUsed: 0,
      imagesUploaded: 0,
      lastReset: new Date()
    };

    await user.save();
    await user.populate('subscription.planId');

    res.json({ 
      success: true,
      message: 'Free plan activated successfully!',
      plan: freePlan.displayName,
      trialEnds: trialEnds,
      limits: freePlan.limits,
      features: freePlan.features.filter(f => f.included)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Create subscription checkout session comes here


// Check usage limits
export const checkUsageLimits = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('subscription.planId');
    const canCreate = await user.canCreatePrompt();
    const plan = user.subscription.planId;

    res.json({
      plan: plan ? plan.displayName : 'No active plan',
      userLevel: user.level,
      usage: {
        promptsCreated: user.usage.promptsCreated,
        promptsThisMonth: user.usage.promptsThisMonth,
        promptsLimit: plan ? plan.limits.promptsLimit : 10,
        apiCalls: user.usage.apiCalls,
        apiLimit: plan ? plan.limits.apiCallsLimit : 100,
        storageUsed: user.usage.storageUsed,
        storageLimit: plan ? plan.limits.storageLimit : 100
      },
      canCreatePrompt: canCreate,
      features: {
        canCreatePrivate: plan ? plan.limits.canCreatePrivate : false,
        canExport: plan ? plan.limits.canExport : false,
        maxCommunities: plan ? plan.limits.maxCommunities : 1,
        aiTools: plan ? plan.limits.aiTools : ['ChatGPT', 'Other']
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// cancel subscription plan
export const cancelSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('subscription.planId');
    const plan = user.subscription.planId;

    if (!plan) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    user.subscription = null;
    await user.save();

    res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
