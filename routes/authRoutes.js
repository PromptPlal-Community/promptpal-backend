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
} from '../controllers/authController.js';
import {protect} from "../middleware/authMiddleware.js"
import { authorizeRoles } from "../middleware/roleMiddleware.js"
import {authorizeRoles} from "../middleware/roleMiddleware.js"
const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/refresh-token', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);


// FOR ADMIN ONLY
router.get('/users', protect, authorizeRoles("admin"), handleGetAllUsers);



export default router;
