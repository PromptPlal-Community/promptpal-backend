
import mongoose from "mongoose";

const PromptSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  promptText: {
    type: String,
    required: true
  },
  resultText: {
    type: String
  },

  images: [{
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    thumbnail_url: String,
    optimized_url: String,
    responsive_urls: [{
      width: Number,
      url: String
    }],
    caption: {
      type: String,
      maxlength: 200
    },
    format: {
      type: String,
      enum: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']
    },
    width: Number,
    height: Number,
    bytes: Number,
    isPrimary: {
      type: Boolean,
      default: false
    },
    transformation: mongoose.Schema.Types.Mixed,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  aiTool: {
    type: String,
    required: true,
    enum: ['ChatGPT', 'Claude', 'Bard', 'Midjourney', 'DALL-E', 'Stable Diffusion', 'Other']
  },
  tags: [{
    type: String,
    trim: true
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isDraft: {
    type: Boolean,
    default: false
  },
  requiresLevel: {
    type: String,
    enum: ['Newbie', 'Contributor', 'Pro', 'Expert'],
    default: 'Newbie'
  },
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner'
  },
  category: {
    type: String,
    enum: ['Art', 'Writing', 'Code', 'Marketing', 'Design', 'Education', 'Other'],
    default: 'Other'
  },
  estimatedTokens: {
    type: Number,
    default: 0
  },
  upvotes: {
    type: Number,
    default: 0
  },
  upvotedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downloads: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: {
      type: String,
      required: true,
      maxlength: 500
    },
    ratings: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      value: {
        type: Number,
        min: 1,
        max: 5
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  version: {
    type: Number,
    default: 1
  },
  parentPrompt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prompt'
  },
  metadata: {
    language: {
      type: String,
      default: 'en'
    },
    wordCount: Number,
    characterCount: Number,
    hasImages: {
      type: Boolean,
      default: false
    },
    hasCode: {
      type: Boolean,
      default: false
    },
    imageCount: {
      type: Number,
      default: 0
    }
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

// Virtual for total images size
PromptSchema.virtual('totalImagesSize').get(function() {
  return this.images.reduce((total, image) => total + (image.bytes || 0), 0);
});

// Virtual for primary image
PromptSchema.virtual('primaryImage').get(function() {
  return this.images.find(img => img.isPrimary) || this.images[0];
});

// Middleware to check plan limits before saving
PromptSchema.pre('save', async function(next) {
  try {
    const User = mongoose.model('User');
    const SubscriptionPlan = mongoose.model('SubscriptionPlan');
    
    const author = await User.findById(this.author).populate('subscription.planId');
    
    if (!author) {
      throw new Error('Author not found');
    }

    // Check if user can create more prompts
    const canCreate = await author.canCreatePrompt();
    if (!canCreate.allowed) {
      throw new Error(canCreate.reason);
    }

    // Check storage limits for images
    if (this.images && this.images.length > 0) {
      const totalSize = this.totalImagesSize;
      const plan = await SubscriptionPlan.findById(author.subscription.planId);
      
      if (plan && plan.limits.storageLimit > 0) {
        const storageUsed = author.usage.storageUsed + totalSize;
        const storageLimitMB = plan.limits.storageLimit * 1024 * 1024; // Convert MB to bytes
        
        if (storageUsed > storageLimitMB) {
          throw new Error(`Storage limit exceeded. Your plan allows ${plan.limits.storageLimit}MB`);
        }
      }
    }

    // Check if user's level is sufficient
    const userLevelIndex = ['Newbie', 'Contributor', 'Pro', 'Expert'].indexOf(author.level);
    const requiredLevelIndex = ['Newbie', 'Contributor', 'Pro', 'Expert'].indexOf(this.requiresLevel);
    
    if (userLevelIndex < requiredLevelIndex) {
      throw new Error(`Your level (${author.level}) is insufficient for this prompt. Required: ${this.requiresLevel}`);
    }

    // Check if prompt is private and user's plan allows it
    if (!this.isPublic) {
      const plan = await SubscriptionPlan.findById(author.subscription.planId);
      if (plan && !plan.limits.canCreatePrivate) {
        throw new Error('Your plan does not allow creating private prompts');
      }
    }

    // Check if AI tool is available in user's plan
    if (author.subscription.planId) {
      const plan = await SubscriptionPlan.findById(author.subscription.planId);
      if (plan.limits.aiTools && plan.limits.aiTools.length > 0 && 
          !plan.limits.aiTools.includes(this.aiTool)) {
        throw new Error(`Your plan does not support ${this.aiTool}`);
      }
    }

    // Update metadata
    this.metadata = {
      ...this.metadata,
      wordCount: this.promptText.split(/\s+/).length,
      characterCount: this.promptText.length,
      hasImages: this.images && this.images.length > 0,
      hasCode: this.promptText.includes('```') || this.resultText.includes('```'),
      imageCount: this.images.length
    };

    // Update user's usage
    if (this.isNew) {
      await author.trackPromptCreation();
      
      // Update storage usage
      if (this.images && this.images.length > 0) {
        author.usage.storageUsed += this.totalImagesSize;
        await author.save();
      }
    }

    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware to handle prompt deletion (clean up Cloudinary)
PromptSchema.pre('remove', async function(next) {
  try {
    const User = mongoose.model('User');
    const CloudinaryService = (await import('../services/CloudinaryService.js')).default;
    
    const author = await User.findById(this.author);
    
    if (author && this.images.length > 0) {
      // Subtract image storage from user's usage
      author.usage.storageUsed = Math.max(0, author.usage.storageUsed - this.totalImagesSize);
      await author.save();
      
      // Delete images from Cloudinary
      for (const image of this.images) {
        try {
          await CloudinaryService.deleteImage(image.public_id);
        } catch (error) {
          console.error(`Failed to delete image ${image.public_id}:`, error.message);
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to add image with Cloudinary data
PromptSchema.methods.addCloudinaryImage = function(cloudinaryResult, caption = '') {
  const imageData = {
    public_id: cloudinaryResult.public_id,
    url: cloudinaryResult.secure_url,
    thumbnail_url: CloudinaryService.generateThumbnailUrl(cloudinaryResult.public_id),
    optimized_url: CloudinaryService.generateOptimizedUrl(cloudinaryResult.public_id),
    responsive_urls: CloudinaryService.generateResponsiveUrls(cloudinaryResult.public_id),
    caption,
    format: cloudinaryResult.format,
    width: cloudinaryResult.width,
    height: cloudinaryResult.height,
    bytes: cloudinaryResult.bytes,
    transformation: cloudinaryResult.transformation
  };

  this.images.push(imageData);
  this.markModified('images');
  return this.save();
};

// Instance method to set primary image
PromptSchema.methods.setPrimaryImage = function(imageIndex) {
  this.images.forEach((img, index) => {
    img.isPrimary = index === imageIndex;
  });
  this.markModified('images');
  return this.save();
};

// Instance method to delete image from Cloudinary and prompt
PromptSchema.methods.deleteCloudinaryImage = async function(imageIndex) {
  if (imageIndex >= 0 && imageIndex < this.images.length) {
    const image = this.images[imageIndex];
    const imageSize = image.bytes || 0;
    
    // Delete from Cloudinary
    const CloudinaryService = (await import('../utils/CloudinaryService.js')).default;
    await CloudinaryService.deleteImage(image.public_id);
    
    // Remove from array
    this.images.splice(imageIndex, 1);
    this.markModified('images');
    
    // Update user storage usage
    const User = mongoose.model('User');
    const author = await User.findById(this.author);
    if (author) {
      author.usage.storageUsed = Math.max(0, author.usage.storageUsed - imageSize);
      await author.save();
    }
    
    return this.save();
  }
  throw new Error('Invalid image index');
};

// Static method to find prompts with images
PromptSchema.statics.findWithImages = function() {
  return this.find({ 'images.0': { $exists: true } })
    .populate('author', 'username profile avatar level');
};

// Static method to get prompts by AI tool with image support
PromptSchema.statics.findByAIToolWithImages = function(aiTool) {
  return this.find({ 
    aiTool, 
    isPublic: true, 
    isDraft: false,
    'images.0': { $exists: true }
  }).populate('author', 'username profile avatar level');
};

export default mongoose.model('Prompt', PromptSchema);