import mongoose from "mongoose";

const RewardTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  tier: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  value: {
    type: Number,
    required: true,
    min: 1
  },
  color: {
    type: String,
    default: '#6b7280'
  },
  icon: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  dailyLimit: {
    type: Number,
    default: null
  },
  cooldown: {
    type: Number,
    default: 0 
  }
}, {
  timestamps: true
});

export default mongoose.model('RewardType', RewardTypeSchema);