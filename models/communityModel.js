import mongoose from 'mongoose';

const CommunitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 300
  },
  profession: {
    type: String,
    enum: ['Developer', 'Marketer', 'Designer', "Content Writer", 'Other'],
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  promptCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Community', CommunitySchema);