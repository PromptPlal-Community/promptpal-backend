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
router.get("/google/callback", 
  passport.authenticate("google", { failureRedirect: "/login", session: false }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173' || 'https://promptpal-frontend-m1a2.vercel.app';
    const userData = encodeURIComponent(JSON.stringify({
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      username: req.user.username,
      avatar: req.user.avatar,
      googleId: req.user.googleId
    }));
    
    res.redirect(`${frontendUrl}/auth/google/callback?token=${token}&user=${userData}`);
  }
);


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



// Add this to your routes/auth.js file
router.get('/debug-google', (req, res) => {
  const expectedUri = 'https://promptpal-backend-j5gl.onrender.com/api/auth/google/callback';
  const actualUri = process.env.GOOGLE_CALLBACK_URL;
  
  const debugInfo = {
    problem: "Google OAuth 'Bad Request' Error",
    description: "This is almost always a redirect URI mismatch",
    solution: "Follow the steps below to fix it",
    
    current_config: {
      expected_redirect_uri: expectedUri,
      actual_redirect_uri: actualUri,
      uris_match: expectedUri === actualUri,
      has_client_id: !!process.env.GOOGLE_CLIENT_ID,
      has_client_secret: !!process.env.GOOGLE_CLIENT_SECRET
    },
    
    fix_instructions: [
      "1. Go to: https://console.cloud.google.com/",
      "2. Select your project",
      "3. Navigate to: APIs & Services → Credentials", 
      "4. Click on your OAuth 2.0 Client ID",
      `5. In 'Authorized redirect URIs' add: ${expectedUri}`,
      "6. Remove any other URIs temporarily",
      "7. Click SAVE",
      "8. Wait 2 minutes and test again"
    ],
    
    common_mistakes: [
      "Using http:// instead of https://",
      "Missing /api in the path", 
      "promptpal-backend-j5gl.onrender.com vs your-custom-domain.com",
      "Extra spaces in the URI",
      "Missing /callback at the end"
    ]
  };
  
  console.log('GOOGLE OAUTH DEBUG INFO:', debugInfo);
  res.json(debugInfo);
});


// routes/auth.js - Add more detailed logging
router.get('/google', (req, res, next) => {
  console.log('🚀 Starting Google OAuth flow');
  console.log('📋 Request details:', {
    originalUrl: req.originalUrl,
    query: req.query,
    headers: req.headers
  });
  next();
}, passport.authenticate('google', { 
  scope: ['profile', 'email'],
  accessType: 'offline',
  prompt: 'consent' // Force consent screen
}));

router.get('/google/callback', (req, res, next) => {
  console.log('🔄 Google callback received');
  console.log('📋 Callback details:', {
    query: req.query,
    hasCode: !!req.query.code,
    hasError: !!req.query.error,
    fullUrl: req.protocol + '://' + req.get('host') + req.originalUrl
  });
  
  if (req.query.error) {
    console.error('❌ Google returned error:', req.query.error);
    console.error('❌ Error description:', req.query.error_description);
  }
  
  next();
}, 
  passport.authenticate('google', { 
    session: false,
    failureRedirect: '/auth/failure' 
  }),
  (req, res) => {
    try {
      console.log('✅ Authentication successful, creating JWT');
      
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET missing');
      }

      const token = jwt.sign(
        { id: req.user._id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173' || 'https://promptpal-frontend-m1a2.vercel.app';
      console.log('🔀 Redirecting to frontend:', frontendUrl);
      
      res.redirect(`${frontendUrl}/auth/success?token=${token}`);
    } catch (error) {
      console.error('❌ JWT creation error:', error);
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173' || 'https://promptpal-frontend-m1a2.vercel.app';
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }
);

// Add failure handler
router.get('/failure', (req, res) => {
  console.error('❌ OAuth failure');
  const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173' || 'https://promptpal-frontend-m1a2.vercel.app';
  res.redirect(`${frontendUrl}/login?error=oauth_failed`);
});



// Add this to routes/auth.js
router.get('/check-oauth-status', (req, res) => {
  const status = {
    oauth_consent_screen: 'Check these items in Google Cloud Console:',
    checks: [
      '1. Go to: APIs & Services → OAuth consent screen',
      '2. User Type: Should be "External" (for public apps) or "Internal"',
      '3. App name: Should be filled',
      '4. User support email: Should be filled', 
      '5. Developer contact info: Should be filled',
      '6. Scopes: Should include ../auth/userinfo.email and ../auth/userinfo.profile',
      '7. Test users: If in testing, your email must be in test users list',
      '8. Publishing: If for production, must be published'
    ],
    test_users_note: 'If your app is in "Testing" status, you MUST add your email to "Test users"',
    publishing_note: 'If your app is for production, you need to verify it with Google (can take days)'
  };
  
  res.json(status);
});
export default router;
