import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
  googleId: { type: String, unique: true },
  name: {
    type: String,
    default: "",
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone:
  {
    type: String,
    default: ""
  },

  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isPasswordLinked: { type: Boolean, default: false },
  avatar: {
    type: String,
    default: ""
  },
  profession: {
    type: String,
    enum: ['Developer', 'Marketer', 'Designer', "Content Writer", 'Other'],
    default: 'Other'
  },
  joinedCommunities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community'
  }],
  level: {
    type: String,
    enum: ['Newbie', 'Contributor', 'Pro', 'Expert'],
    default: 'Newbie'
  },
  profile: {
    bio: String,
    dob: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    location: String,

    socialLinks: {
      website: String,
      twitter: String,
      github: String,
      linkedin: String
    }
  },
  currencyPreference: {
    type: String,
    enum: ['USD', 'NGN'],
    default: 'USD'
  },
  paymentMethods: [{
    gateway: {
      type: String,
      enum: ['stripe', 'paystack', 'paypal', 'flutterwave'],
      
    },
    customerId: String,
    paymentMethodId: String,
    isDefault: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  subscription: {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan'
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'inactive', 'trial'],
      default: 'inactive'
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    },
    trialEndsAt: Date,
    gateway: String,
    gatewaySubscriptionId: String
  },
  usage: {
    promptsCreated: {
      type: Number,
      default: 0
    },
    promptsThisMonth: {
      type: Number,
      default: 0
    },
    apiCalls: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number,
      default: 0
    }, 
    imagesUploaded: {
      type: Number,
      default: 0
    },
    lastReset: {
      type: Date,
      default: Date.now
    }
  },
  preferences: {
    maxImageSize: {
      type: Number,
      default: 5 * 1024 * 1024
    },
    allowedFormats: [{
      type: String,
      enum: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }],
    autoCompressImages: {
      type: Boolean,
      default: true
    }
  },
  billingAddress: {
    country: String,
    state: String,
    city: String,
    postalCode: String,
    line1: String,
    line2: String
  },
  resetPasswordWithOTP: String,
  resetPasswordExpires: Date,
  otp: String,
  otpExpires: Date,
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  favoritePrompts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prompt'
  }],
  lastLogin: Date,
  isVerified: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'prompt-creator', 'admin', 'superadmin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

UserSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  this.updatedAt = Date.now();
  next();
});

UserSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.matchPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user can create more prompts based on plan
UserSchema.methods.canCreatePrompt = async function() {
  await this.populate('subscription.planId');
  const plan = this.subscription.planId;
  
  if (!plan) {
    return { allowed: false, reason: 'No active subscription plan' };
  }

  // Reset monthly usage if it's a new month
  const now = new Date();
  const lastReset = new Date(this.usage.lastReset);
  if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    this.usage.promptsThisMonth = 0;
    this.usage.imagesUploaded = 0;
    this.usage.lastReset = now;
    await this.save();
  }

  const promptsLimit = plan.limits.promptsLimit;
  const currentUsage = this.usage.promptsThisMonth;

  if (promptsLimit !== -1 && currentUsage >= promptsLimit) {
    return {
      allowed: false,
      reason: `Monthly prompt limit reached (${promptsLimit})`,
      resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1)
    };
  }

  return {
    allowed: true,
    remaining: promptsLimit === -1 ? 'unlimited' : promptsLimit - currentUsage,
    currentUsage: currentUsage
  };
};

// Check if user can upload more images based on storage limit
UserSchema.methods.canUploadImage = async function(imageSize) {
  await this.populate('subscription.planId');
  const plan = this.subscription.planId;
  
  if (!plan) {
    return { allowed: false, reason: 'No active subscription plan' };
  }

  const storageLimitBytes = plan.limits.storageLimit * 1024 * 1024;
  const projectedUsage = this.usage.storageUsed + imageSize;

  if (storageLimitBytes > 0 && projectedUsage > storageLimitBytes) {
    return {
      allowed: false,
      reason: `Storage limit exceeded. ${Math.ceil((storageLimitBytes - this.usage.storageUsed) / 1024 / 1024)}MB remaining`
    };
  }

  return {
    allowed: true,
    remainingBytes: storageLimitBytes - this.usage.storageUsed,
    currentUsage: this.usage.storageUsed
  };
};

// Track prompt creation
UserSchema.methods.trackPromptCreation = async function() {
  this.usage.promptsCreated += 1;
  this.usage.promptsThisMonth += 1;
  await this.save();
};

// Track image upload
UserSchema.methods.trackImageUpload = async function(imageSize) {
  this.usage.storageUsed += imageSize;
  this.usage.imagesUploaded += 1;
  await this.save();
};

// Get storage usage summary
UserSchema.methods.getStorageSummary = function() {
  const plan = this.subscription.planId;
  const storageLimitBytes = plan ? plan.limits.storageLimit * 1024 * 1024 : 100 * 1024 * 1024;
  
  return {
    used: this.usage.storageUsed,
    limit: storageLimitBytes,
    usedPercentage: ((this.usage.storageUsed / storageLimitBytes) * 100).toFixed(1),
    remaining: storageLimitBytes - this.usage.storageUsed,
    formatted: {
      used: `${(this.usage.storageUsed / 1024 / 1024).toFixed(2)}MB`,
      limit: `${(storageLimitBytes / 1024 / 1024).toFixed(0)}MB`,
      remaining: `${((storageLimitBytes - this.usage.storageUsed) / 1024 / 1024).toFixed(2)}MB`
    }
  };
};

export default mongoose.model('User', UserSchema);