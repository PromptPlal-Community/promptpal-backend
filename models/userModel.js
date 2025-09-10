import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
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
  password: {
    type: String,
    required: true,
    minlength: 6
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
  points: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isVerified: { type: Boolean, default: false },

    otp: String,
    otpExpires: Date,
    favourites: [{type: mongoose.Schema.Types.ObjectId, ref: "Prompt",}]
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

export default mongoose.model('User', UserSchema);