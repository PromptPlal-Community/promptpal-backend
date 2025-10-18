import mongoose from "mongoose";

const SubscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['basic', 'standard', 'premium'],
    default: 'basic',
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },

  pricing: {
    USD: {
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 }
    },
    NGN: {
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 }
    }
  },

limits: {
    promptsLimit: { type: Number, default: 10 },
    apiCallsLimit: { type: Number, default: 100 },
    storageLimit: { type: Number, default: 1000 },
    maxImageSize: { type: Number, default: 5 },
    maxImagesPerPrompt: { type: Number, default: 2 },
    maxCommunities: { type: Number, default: 1 },
    canCreatePrivate: { type: Boolean, default: false },
    canExport: { type: Boolean, default: false },
    maxPromptLength: { type: Number, default: 1000 },
    imageFormats: {
      type: [String],
      default: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
  },
  

  features: [{
    name: String,
    included: Boolean,
    description: String
  }],
  

  gatewayIds: {
    stripe: {
      monthly: String,
      yearly: String
    },
    paystack: {
      monthly: String,
      yearly: String
    }
  },
  
  
  isActive: {
    type: Boolean,
    default: true
  },
  isFree: {
    type: Boolean,
    default: false
  },
  tier: {
    type: Number,
    required: true,
    min: 1,
    max: 3
  },
  badgeColor: {
    type: String,
    default: '#6B7280'
  },
  levelRequired: {
    type: String,
    enum: ['Newbie', 'Contributor', 'Pro', 'Expert'],
    default: 'Newbie'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});


SubscriptionPlanSchema.virtual('formattedPricing').get(function() {
  const formatPrice = (amount, currency) => {
    if (currency === 'USD') return `$${(amount / 100).toFixed(2)}`;
    if (currency === 'NGN') return `₦${(amount / 100).toFixed(2)}`;
    return amount;
  };

  return {
    USD: {
      monthly: formatPrice(this.pricing.USD.monthly, 'USD'),
      yearly: formatPrice(this.pricing.USD.yearly, 'USD')
    },
    NGN: {
      monthly: formatPrice(this.pricing.NGN.monthly, 'NGN'),
      yearly: formatPrice(this.pricing.NGN.yearly, 'NGN')
    }
  };
});

export default mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);