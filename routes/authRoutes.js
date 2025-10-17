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
import passport from '../config/passport.js';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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
router.get('/google', (req, res, next) => {
  console.log('🚀 Starting Google OAuth flow');
  
  // Force consent screen to ensure popup works
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    accessType: 'offline',
    prompt: 'consent'
  })(req, res, next);
});

// Google Callback Route
router.get('/google/callback',
  passport.authenticate('google', { 
    session: false, 
    failureRedirect: '/auth/google/failure' 
  }),
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

      // HTML response for popup flow
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Authentication Complete</title>
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
      max-width: 400px;
    }
    .success { color: #059669; }
    .info { 
      background: #dbeafe; 
      padding: 1rem; 
      border-radius: 8px; 
      margin: 1rem 0;
      font-size: 14px;
    }
    .button {
      background: #8b5cf6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      margin: 1rem 0;
    }
    .button:hover { background: #7c3aed; }
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
    <div id="popupView">
      <div class="spinner"></div>
      <p class="success">Authentication successful! Closing window...</p>
    </div>
  </div>

  <script>
    (function() {
      try {
        const token = "${token}";
        const userData = ${JSON.stringify(userData)};
        
        console.log('🔐 Sending auth data to opener...');
        
        // Send message to opener window
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_SUCCESS',
            token: token,
            user: userData
          }, window.location.origin);
          
          console.log('✅ Message sent to opener');
          
          // Close the popup after a short delay
          setTimeout(() => {
            if (!window.closed) {
              window.close();
            }
          }, 1000);
        } else {
          console.warn('❌ No opener found - this might be a redirect');
          // Fallback: store in localStorage and show message
          localStorage.setItem('google_auth_token', token);
          localStorage.setItem('google_auth_user', JSON.stringify(userData));
          localStorage.setItem('google_auth_time', Date.now().toString());
          
          document.getElementById('popupView').innerHTML = '
            <h2 class="success">✅ Authentication Successful!</h2>
            <p>You can safely close this window and return to the app.</p>
            <button class="button" onclick="window.close()">Close Window</button>
          ';
        }
      } catch (error) {
        console.error('❌ Error in auth callback:', error);
        
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: error.message
          }, window.location.origin);
        }
        
        document.getElementById('popupView').innerHTML = '
          <h2 style="color: #dc2626;">❌ Authentication Failed</h2>
          <p>' + error.message + '</p>
          <button class="button" onclick="window.close()">Close</button>
        ';
      }
    })();
  </script>
</body>
</html>
      `;
      
      res.send(html);
      
    } catch (error) {
      console.error('❌ Google callback error:', error);
      res.redirect('/auth/google/failure');
    }
  }
);

// Failure handler
router.get('/google/failure', (req, res) => {
  console.error('❌ Google OAuth failed');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Failed</title>
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
    .button {
      background: #dc2626;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>❌ Authentication Failed</h2>
    <p>Google authentication failed. Please try again.</p>
    <button class="button" onclick="window.close()">Close Window</button>
  </div>
</body>
</html>
  `;
  
  res.send(html);
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
