import mongoose from 'mongoose';

const CommunitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  rules: [{
    title: String,
    description: String
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  tags: [String],
  memberCount: {
    type: Number,
    default: 0
  },
  trendCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});


CommunitySchema.index({ name: 'text', description: 'text', tags: 'text' });


export default mongoose.model('Community', CommunitySchema);