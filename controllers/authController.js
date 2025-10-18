// controllers/authController.js
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendOTPEmail, sendWelcomeEmail } from "../utils/sendEmail.js";
import SubscriptionPlan from "../models/SubscriptionPlanModel.js";
import e from "express";

// Token generation functions
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



// REGISTER with basic details and basic free subscription
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     description: Creates a new user account with free basic subscription
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - username
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 example: "johndoe123"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "Password123"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Registered successfully. Check your email for OTP."
 *                 token:
 *                   type: string
 *                   description: JWT token for verification
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 subscription:
 *                   type: object
 *                   properties:
 *                     plan:
 *                       type: string
 *                       example: "Starter Plan"
 *                     status:
 *                       type: string
 *                       example: "trial"
 *                     trialEnds:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - validation error or user exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
      otpExpires: Date.now() + 10 * 60 * 1000,
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
      await sendOTPEmail(email, otp);
    } catch (emailError) {
      console.error('Email error:', emailError);
    }

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


// Link email/password to Google account
/**
 * @swagger
 * /auth/link-password:
 *   post:
 *     summary: Link email/password login to a Google account
 *     security:
 *      - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LinkPasswordRequest'
 *     responses:
 *       200:
 *         description: Password linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password successfully linked, you can now log in with email"
 *       400:
 *         description: Password already linked or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const linkGooglePassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 chars" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isPasswordLinked) {
      return res.status(400).json({ message: "Password already linked" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.isPasswordLinked = true;
    await user.save();

    res.json({ message: "Password successfully linked, you can now log in with email" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



// LOGIN
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     description: Authenticate user and return JWT tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "Password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials or email not verified
 *       500:
 *         description: Internal server error
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password, username } = req.body;

    let user;
    if (email) {
      user = await User.findOne({ email });
    } else if (username) {
      user = await User.findOne({ username });
    }
    
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account is blocked." });
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

    user.lastLogin = new Date();
    
    
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();


    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     description: Get new access token using refresh token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Token refreshed successfully"
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Refresh token missing or invalid
 *       500:
 *         description: Internal server error
 */
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
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     description: Logout user and invalidate tokens
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User logged out successfully"
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Access and refresh token missing or invalid
 *       500:
 *         description: Internal server error
 */
export const logoutUser = (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.status(200).json({ message: "Logged out successfully" });
};

// VERIFY EMAIL
/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email with OTP
 *     tags: [Authentication]
 *     description: Verify user's email address using OTP sent during registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid or expired OTP
 *       500:
 *         description: Internal server error
 */
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
/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend OTP for email verification
 *     tags: [Authentication]
 *     description: Resend a new OTP to the user's email for verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    try {
      await user.save();
    } catch (saveError) {
      console.error('Error saving user:', saveError);
      return res.status(500).json({ message: "Failed to save OTP" });
    }

    try {
      await sendOTPEmail(email, otp);
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
/**
 * @swagger
 * /auth/reset-otp:
 *   post:
 *     summary: Send OTP for password reset
 *     tags: [Authentication]
 *     description: Send a one-time password (OTP) to the user's email for password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 */
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
/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Authentication]
 *     description: Reset user's password using the OTP sent to their email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "NewPassword123"
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid or expired OTP
 *       500:
 *         description: Internal server error
 */
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
/**
 * @swagger
 * /auth/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Authentication]
 *     description: Retrieve a list of all registered users (admin access required)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Users retrieved successfully"
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 count:
 *                   type: integer
 *                   example: 10
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
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
      profile: users.profile,
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
/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Authentication]
 *     description: Retrieve the profile information of the logged-in user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
export const handleGetUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -otp -otpExpires');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user,
      profile: user.profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: error.message });
  }
};

// UPDATE USER PROFILE
/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     description: Update the profile information of the logged-in user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               profession:
 *                 type: string
 *                 example: "Developer"
 *               bio:
 *                 type: string
 *                 example: "Passionate developer and tech enthusiast."
 *               location:
 *                 type: string
 *                 example: "New York, USA"
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: "https://johndoe.com"
 *               twitter:
 *                 type: string
 *                 format: uri
 *                 example: "https://twitter.com/johndoe"
 *               github:
 *                 type: string
 *                 format: uri
 *                 example: "https://github.com/johndoe"
 *               linkedin:
 *                 type: string
 *                 format: uri
 *                 example: "https://linkedin.com/in/johndoe"
 */
export const handleUpdateUserProfile = async (req, res) => {
  try {
    const { name, phone, profession, bio, dob, gender, location, website, twitter, github, linkedin } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update basic fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (profession) user.profession = profession;
    
    // Update profile fields
    if (bio) user.profile.bio = bio;
    if (dob) user.profile.dob = dob;
    if (gender) user.profile.gender = gender;
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
        phone: user.phone,
        profession: user.profession,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
};


// USER UPDATE THEIR PROFESSION and add 
/**
 * @swagger
 * /auth/update-profession:
 *   put:
 *     summary: Update user profession
 *     tags: [Authentication]
 *     description: Update the profession of the logged-in user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profession
 *             properties:
 *               profession:
 *                 type: string
 *                 example: "Developer"
 *     responses:
 *       200:
 *         description: Profession updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Profession updated successfully"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Profession is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
export const handleUpdateProfession = async (req, res) => {
  try {
    const { profession } = req.body;
    
    if (!profession) {
      return res.status(400).json({ message: "Profession is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.profession = profession;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profession updated successfully",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profession: user.profession,
        level: user.level
      }
    });
  } catch (error) {
    console.error('Update profession error:', error);
    res.status(500).json({ message: error.message });
  }
};

// TODO: UPDATE USER LEVEL BASED ON USAGE, PROMPTS CREATED, COMMUNITIES JOINED, REVIEWS, CREATED, LIKES, SHARES, ENGAGEMENT OVER TIME ETC AND SUBSCRIPTION PLAN
