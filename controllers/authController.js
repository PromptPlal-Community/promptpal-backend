import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendOTPEmail } from "../utils/sendEmail.js";


const generateAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};


const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};


export const registerUser = async (req, res) => {
    try {
    const { name, username, email, password, profession } = req.body;

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

   // generate otp
    const otp = crypto.randomInt(100000, 999999).toString();
 // Create new user
    const newUser = await User.create({
      name,
      username,
      email,
      password,
      profession,
      otp,
      otpExpires: Date.now() + 10 * 60 * 1000,
      isVerified: false,
    });
      await newUser.save();
    

    // Generate JWT
    const payload = { id: user._id };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });

    try {
      await sendOTPEmail(email, "Verify your email", otp);
    } catch (emailError) {
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    res.status(201).json({
      message: "Registered successfully. Check your email for OTP.",
      token,
        newUser: {
          id: newUser.id,
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          profession: newUser.profession,
          level: newUser.level
        }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// LOGIN
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Email not verified. Please verify to login." });
    }


    user.lastLogin = Date.now();
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000, // 15 mins
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
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        profession: user.profession,
        level: user.level
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// REFRESH TOKEN
export const refreshAccessToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "Refresh token missing" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Invalid token" });

    const newAccessToken = generateAccessToken(user);
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({ message: "Token refreshed" });
  } catch (err) {
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
    if (!user || !user.otp || !user.otpExpires)
      return res.status(400).json({ message: "Invalid or expired OTP" });

    if (user.otp !== otp || user.otpExpires < Date.now())
      return res.status(400).json({ message: "Incorrect or expired OTP" });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// RESEND OTP
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendOTPEmail(email, "Your new OTP Code", otp);
    } catch (emailError) {
      return res.status(500).json({ message: "Failed to send OTP email" });
    }
    res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// FORGOT PASSWORD
export const sendResetOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendOTPEmail(email, "Password Reset OTP", otp);
    } catch (emailError) {
      return res.status(500).json({ message: "Failed to send OTP email" });
    }
    res.status(200).json({ message: "Reset OTP sent to email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// RESET PASSWORD
export const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.otp !== otp || user.otpExpires < Date.now())
      return res.status(400).json({ message: "Invalid or expired OTP" });

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL REGISTERED USERS
export const handleGetAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    res.status(200).json({
      success: true,
      message: "User accounts found",
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
