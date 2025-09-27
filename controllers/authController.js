// controllers/authController.js
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendOTPEmail, sendWelcomeEmail } from "../utils/sendEmail.js";
import SubscriptionPlan from "../models/SubscriptionPlanModel.js";
import e from "express";

const generateAccessToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

// Welcome to PromptPal!
export const welcomeMessage = (req, res) => {
  res.status(200).json({ message: "Welcome to PromptPal API! Your number one source for AI-generated prompts community." });
};


// REGISTER with basic details and basic free subscription
export const registerUser = async (req, res) => {
  try {
    const { name, username, email, password, profession, level } = req.body;

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Get the free basic plan
    let freePlan = await SubscriptionPlan.findOne({ name: 'basic' });

    if (freePlan) {
    // If the plan exists but is not free, update it to be free
    if (!freePlan.isFree) {
        freePlan.isFree = true;
        await freePlan.save();
    }
    } else {
      // If the plan doesn't exist, create it
      console.log('Creating basic free plan...');
      freePlan = await SubscriptionPlan.create({
        name: 'basic',
        displayName: 'Basic Plan',
        description: 'Free basic plan',
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
          storageLimit: 100, // 100MB
          maxImageSize: 5, // 5MB
          maxImagesPerPrompt: 5,
          maxCommunities: 2,
          canCreatePrivate: false,
          canExport: false,
          maxPromptLength: 1000,
          aiTools: ['ChatGPT', 'Other']
        },
        features: [
          { name: 'Create Public Prompts', included: true },
          { name: 'Join Communities', included: true },
          { name: 'Basic AI Tools', included: true },
          { name: 'Image Uploads', included: true },
          { name: 'Private Prompts', included: false },
          { name: 'Export Features', included: false }
        ],
        isActive: true
      });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Set trial period (30 days)
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 30);

    // Create new user with free subscription
    const newUser = await User.create({
      name,
      username,
      email,
      password,
      profession,
      level: level || 'Newbie',
      otp,
      otpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
      isVerified: false,
      isEmailVerified: false,
      subscription: {
        planId: freePlan._id,
        status: 'trial',
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnds,
        trialEndsAt: trialEnds
      },
      usage: {
        promptsCreated: 0,
        promptsThisMonth: 0,
        apiCalls: 0,
        storageUsed: 0,
        imagesUploaded: 0,
        lastReset: new Date()
      }
    });

    // Generate JWT token for verification
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { 
      expiresIn: '1d' 
    });

    try {
      await sendOTPEmail(email, "Verify your email", otp);
      console.log({ email, otp });
    } catch (emailError) {
      console.error('Email error:', emailError);
      // Still return success but log the email error
    }

    // Populate the subscription plan details for response
    await newUser.populate('subscription.planId');

    res.status(201).json({
      message: "Registered successfully. Check your email for OTP.",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        profession: newUser.profession,
        level: newUser.level,
        subscription: newUser.subscription
      },
      subscription: {
        plan: freePlan.displayName,
        status: 'trial',
        trialEnds: trialEnds,
        limits: freePlan.limits,
        features: freePlan.features.filter(f => f.included)
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
};

// LOGIN
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified || !user.isEmailVerified) {
      return res.status(403).json({ 
        message: "Email not verified. Please verify your email to login." 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profession: user.profession,
        level: user.level,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
};



// REFRESH TOKEN
export const refreshAccessToken = async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;
  
  if (!token) {
    return res.status(401).json({ message: "Refresh token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const newAccessToken = generateAccessToken(user);
    
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({ 
      message: "Token refreshed successfully",
      accessToken: newAccessToken 
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(403).json({ message: "Expired or invalid refresh token" });
  }
};

// LOGOUT
export const logoutUser = (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.status(200).json({ message: "Logged out successfully" });
};

// VERIFY EMAIL
export const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ message: "No OTP found or OTP expired" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Mark user as verified
    user.isVerified = true;
    user.isEmailVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    try {
      await sendWelcomeEmail(email, "Welcome to PromptPal", user.name);
    } catch (emailError) {
      console.error('Email error:', emailError);
      return res.status(500).json({ message: "Failed to send welcome email" });
    }


    res.status(200).json({ 
      message: "Email verified successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: error.message });
  }
};

// RESEND OTP
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    try {
      await sendOTPEmail(email, "Your new OTP Code", otp);
      res.status(200).json({ message: "OTP resent successfully" });
    } catch (emailError) {
      console.error('Email error:', emailError);
      return res.status(500).json({ message: "Failed to send OTP email" });
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: error.message });
  }
};

// FORGOT PASSWORD
export const sendResetOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendOTPEmail(email, "Password Reset OTP", otp);
      res.status(200).json({ message: "Reset OTP sent to email" });
    } catch (emailError) {
      console.error('Email error:', emailError);
      return res.status(500).json({ message: "Failed to send OTP email" });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: error.message });
  }
};

// RESET PASSWORD
export const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.otp || user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Update password
    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: error.message });
  }
};

// GET ALL USERS (Admin only)
export const handleGetAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -otp -otpExpires');
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      users,
      count: users.length
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET USER PROFILE
export const handleGetUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -otp -otpExpires');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: error.message });
  }
};

// UPDATE USER PROFILE
export const handleUpdateUserProfile = async (req, res) => {
  try {
    const { name, profession, bio, location, website, twitter, github, linkedin } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update basic fields
    if (name) user.name = name;
    if (profession) user.profession = profession;
    
    // Update profile fields
    if (bio) user.profile.bio = bio;
    if (location) user.profile.location = location;
    
    // Update social links
    if (website) user.profile.socialLinks.website = website;
    if (twitter) user.profile.socialLinks.twitter = twitter;
    if (github) user.profile.socialLinks.github = github;
    if (linkedin) user.profile.socialLinks.linkedin = linkedin;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profession: user.profession,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
};