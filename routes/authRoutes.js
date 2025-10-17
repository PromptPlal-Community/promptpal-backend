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
import passport from '../config/passport.js';
import { generateState } from '../config/passport.js';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

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
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5,
  message: 'Too many authentication attempts, please try again later.'
});

router.use('/google', authLimiter);
router.use('/google/callback', authLimiter);

// Store active states (in production, use Redis)
const activeStates = new Map();

// Google Auth Route with CSRF protection
router.get('/google', (req, res, next) => {
  const state = generateState();
  const redirectUri = req.query.redirect_uri || '/dashboard';
  
  // Store state with expiration (10 minutes)
  activeStates.set(state, {
    redirectUri: redirectUri,
    timestamp: Date.now(),
    ip: req.ip
  });
  
  // Clean up expired states
  const now = Date.now();
  for (const [key, value] of activeStates.entries()) {
    if (now - value.timestamp > 10 * 60 * 1000) {
      activeStates.delete(key);
    }
  }

  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    accessType: 'offline',
    prompt: 'consent',
    state: state // CSRF protection
  })(req, res, next);
});

// Secure Google Callback
router.get('/google/callback',
  (req, res, next) => {
    // Validate state parameter
    const { state, code, error } = req.query;
    
    if (error) {
      return res.redirect(`/auth/failure?error=${encodeURIComponent(error)}`);
    }
    
    if (!state || !activeStates.has(state)) {
      return res.redirect('/auth/failure?error=invalid_state');
    }
    
    const stateData = activeStates.get(state);
    
    // Validate IP address (optional additional security)
    if (stateData.ip !== req.ip) {
      activeStates.delete(state);
      return res.redirect('/auth/failure?error=ip_mismatch');
    }
    
    // Clean up used state
    activeStates.delete(state);
    
    // Store state data for use in the callback
    req.stateData = stateData;
    next();
  },
  passport.authenticate('google', { 
    session: false, 
    failureRedirect: '/auth/failure' 
  }),
  (req, res) => {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('Server configuration error');
      }

      // Create secure JWT token
      const token = jwt.sign(
        { 
          id: req.user._id, 
          email: req.user.email,
          type: 'google_auth',
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { 
          expiresIn: '7d',
          issuer: 'PromptPal Community',
          subject: req.user._id.toString()
        }
      );

      const userData = {
        _id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        username: req.user.username,
        avatar: req.user.avatar,
        isEmailVerified: req.user.isEmailVerified,
        authMethod: req.user.authMethod
      };

      const nonce = crypto.randomBytes(16).toString('base64');
      
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Complete</title>
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    base-uri 'self';
    form-action 'none';
    frame-ancestors 'none';
  ">
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="X-Frame-Options" content="DENY">
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
    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Completing authentication...</p>
  </div>
  
  <!-- Secure data storage -->
  <div id="authData" class="hidden" data-token="${token}" data-user='${JSON.stringify(userData).replace(/'/g, "&apos;")}'></div>
  
  <script nonce="${nonce}">
    (function() {
      'use strict';
      
      try {
        const authData = document.getElementById('authData');
        const token = authData.getAttribute('data-token');
        const userJson = authData.getAttribute('data-user').replace(/&apos;/g, "'");
        const user = JSON.parse(userJson);
        
        // Validate data exists
        if (!token || !user || !user._id) {
          throw new Error('Invalid authentication data');
        }
        
        // Secure message passing
        if (window.opener && !window.opener.closed && window.opener !== window) {
          const targetOrigin = window.location.origin;
          
          // Send secure message
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_SUCCESS',
            token: token,
            user: user,
            timestamp: Date.now()
          }, targetOrigin);
          
          // Close window after secure delay
          setTimeout(() => {
            if (!window.closed) {
              window.close();
            }
          }, 1000);
        } else {
          // Fallback for non-popup flow
          localStorage.setItem('pending_auth', JSON.stringify({
            token: token,
            user: user,
            timestamp: Date.now(),
            source: 'google'
          }));
          
          document.body.innerHTML = 
            '<div class="container">' +
            '<h2 style="color: #059669;">✅ Authentication Complete</h2>' +
            '<p>You can safely close this window and return to the application.</p>' +
            '</div>';
        }
      } catch (error) {
        console.error('Authentication error:', error);
        
        if (window.opener && !window.opener.closed && window.opener !== window) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: 'Authentication failed'
          }, window.location.origin);
        }
        
        document.body.innerHTML = 
          '<div class="container">' +
          '<h2 style="color: #dc2626;">❌ Authentication Failed</h2>' +
          '<p>Please try again or contact support.</p>' +
          '</div>';
      }
    })();
  </script>
</body>
</html>
      `;
      
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.send(html);
      
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect('/auth/failure?error=server_error');
    }
  }
);

// Failure handler
router.get('/failure', (req, res) => {
  const error = req.query.error || 'authentication_failed';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Failed</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline';">
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
    <h2>❌ Authentication Failed</h2>
    <p>Please try again or contact support.</p>
    <button onclick="window.close()" style="
      background: #dc2626; 
      color: white; 
      border: none; 
      padding: 12px 24px; 
      border-radius: 8px; 
      cursor: pointer; 
      margin: 1rem 0;
    ">Close Window</button>
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
