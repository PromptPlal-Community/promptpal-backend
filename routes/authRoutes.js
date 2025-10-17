import express from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  verifyEmailOTP as verifyEmail,
  resendOTP as resendOtp,
  sendResetOTP as forgotPassword,
  resetPasswordWithOTP as resetPassword,
  refreshAccessToken,
  handleGetAllUsers,
  handleGetUserProfile,
  handleUpdateUserProfile,
  handleUpdateProfession,
  linkGooglePassword,

} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import passport from 'passport';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
const router = express.Router();


// Google Auth
/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Register a new user via Google
 *     tags: [Authentication]
 *     description: Google redirects back here. Exchanges code for tokens and logs in the user.
 *     responses:
 *       200:
 *         description: Returns JWT and user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));



/**
 * @swagger
 * /auth/link/google:
 *   get:
 *     summary: Redirect to Google to link account
 *     tags: [Authentication]
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       302:
 *         description: Redirects to Google for linking
 */
import path from 'path';
import fs from 'fs';

router.get('/auth-success.js', (req, res) => {
  // Set correct MIME type for JavaScript
  res.setHeader('Content-Type', 'application/javascript');
  
  const script = `
    // Get data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || urlParams.get('accessToken');
    const user = urlParams.get('user');

    console.log('Auth success script loaded');
    console.log('Token exists:', !!token);
    console.log('User exists:', !!user);

    if (token && user) {
      try {
        const userData = JSON.parse(decodeURIComponent(user));
        console.log('User data parsed successfully:', userData.email);
        
        // Send success message to opener
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_SUCCESS',
            token: token,
            user: userData
          }, window.location.origin);
          console.log('Success message sent to opener');
        } else {
          console.error('Opener window is closed or unavailable');
        }
        
        // Close the popup after a short delay
        setTimeout(() => {
          window.close();
        }, 1000);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: 'Failed to parse user data: ' + error.message
          }, window.location.origin);
        }
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    } else {
      console.error('Missing token or user data');
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_ERROR',
          error: 'Missing token or user data'
        }, window.location.origin);
      }
      setTimeout(() => {
        window.close();
      }, 1000);
    }
  `;
  
  res.send(script);
});

// Serve auth-error.js with proper MIME type
router.get('/auth-error.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  
  const script = `
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    console.log('Auth error script loaded, error:', error);

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        type: 'GOOGLE_AUTH_ERROR',
        error: error || 'Authentication failed'
      }, window.location.origin);
      console.log('Error message sent to opener');
    }

    setTimeout(() => {
      window.close();
    }, 1000);
  `;
  
  res.send(script);
});


// routes/auth.js - Updated Google callback route
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/google/failure' }),
  (req, res) => {
    try {
      console.log('✅ Google authentication successful for:', req.user.email);
      
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
      }

      // Create JWT token
      const token = jwt.sign(
        { id: req.user._id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const userData = {
        _id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        username: req.user.username,
        avatar: req.user.avatar,
        googleId: req.user.googleId,
        isEmailVerified: req.user.isEmailVerified,
        authMethod: req.user.authMethod
      };

      // HTML with inline script using data attributes
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Authentication</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f9fafb;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      border: 3px solid #f3f4f6;
      border-top: 3px solid #8b5cf6;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Authentication successful! Closing window...</p>
  </div>
  
  <!-- Hidden divs to store data -->
  <div id="authData" data-token="${token}" data-user='${JSON.stringify(userData).replace(/'/g, "&#39;")}' style="display: none;"></div>
  
  <script>
    try {
      console.log('Processing authentication...');
      const authData = document.getElementById('authData');
      const token = authData.getAttribute('data-token');
      const userJson = authData.getAttribute('data-user').replace(/&#39;/g, "'");
      const user = JSON.parse(userJson);
      
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('User:', user ? user.email : 'Missing');
      
      if (token && user) {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_SUCCESS',
            token: token,
            user: user
          }, window.location.origin);
          console.log('Success message sent to opener');
        } else {
          console.error('Opener window is closed or unavailable');
        }
        
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        throw new Error('Missing token or user data');
      }
    } catch (error) {
      console.error('Error in auth script:', error);
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_ERROR',
          error: error.message
        }, window.location.origin);
      }
      setTimeout(() => {
        window.close();
      }, 1000);
    }
  </script>
</body>
</html>
      `;
      
      res.send(html);
      
    } catch (error) {
      console.error('❌ Google callback error:', error);
      
      const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Authentication</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f9fafb;
    }
    .container {
      text-align: center;
      padding: 2rem;
      color: #dc2626;
    }
  </style>
</head>
<body>
  <div class="container">
    <p>Authentication failed! Closing window...</p>
  </div>
  
  <div id="errorData" data-error="${error.message.replace(/'/g, "&#39;")}" style="display: none;"></div>
  
  <script>
    try {
      const errorData = document.getElementById('errorData');
      const error = errorData.getAttribute('data-error').replace(/&#39;/g, "'");
      
      console.error('Authentication error:', error);
      
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_ERROR',
          error: error
        }, window.location.origin);
      }
      
      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (scriptError) {
      console.error('Error in error script:', scriptError);
      setTimeout(() => {
        window.close();
      }, 1000);
    }
  </script>
</body>
</html>
      `;
      
      res.send(errorHtml);
    }
  }
);

// Update failure handler
router.get('/google/failure', (req, res) => {
  console.error('❌ Google OAuth failed');
  
  const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Authentication</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f9fafb;
    }
    .container {
      text-align: center;
      padding: 2rem;
      color: #dc2626;
    }
  </style>
</head>
<body>
  <div class="container">
    <p>Authentication failed! Closing window...</p>
  </div>
  
  <script>
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        type: 'GOOGLE_AUTH_ERROR',
        error: 'Google authentication failed'
      }, window.location.origin);
    }
    
    setTimeout(() => {
      window.close();
    }, 1000);
  </script>
</body>
</html>
  `;
  
  res.send(errorHtml);
});


// Callback after Google approval
/**
 * @swagger
 * /auth/link/google/callback:
 *   get:
 *     summary: Google callback for account linking
 *     tags: [Authentication]
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully linked Google account
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Google account linked successfully }
 *                 user: { $ref: '#/components/schemas/AuthResponse' }
 */
router.get("/link/google/callback", 
  passport.authenticate("google", { failureRedirect: "/login", session: false }),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      if (!user.googleId) {
        user.googleId = req.user.googleId;
        user.avatar = req.user.avatar;
        await user.save();
      }

    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173' || 'https://promptpal-frontend-m1a2.vercel.app';
      const userData = encodeURIComponent(JSON.stringify({
        googleId: user.googleId,
        avatar: user.avatar
      }));
      
      res.redirect(`${frontendUrl}/auth/google/callback?type=link&user=${userData}`);
    } catch (error) {
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173' || 'https://promptpal-frontend-m1a2.vercel.app';
      res.redirect(`${frontendUrl}/auth/google/callback?error=${encodeURIComponent(error.message)}`);
    }
  }
);



router.post("/link-password", protect, linkGooglePassword);

router.post('/register', registerUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/refresh-token', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/users', protect, handleGetAllUsers);

// get user profile
router.get('/profile', protect, handleGetUserProfile);

// update user profile
router.patch('/profile', protect, handleUpdateUserProfile);

// update user profession
router.patch('/profile/profession', protect, handleUpdateProfession);

export default router;
