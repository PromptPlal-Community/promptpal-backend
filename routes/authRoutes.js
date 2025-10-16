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


export default router;
