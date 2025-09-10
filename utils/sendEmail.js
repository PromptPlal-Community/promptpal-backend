import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Email wrapper for consistent branding
const emailWrapper = (content) => `
  <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
    <div style="padding: 1rem; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: auto;">
      <div style="text-align: center; margin-bottom: 1rem;">
        <img src="https://yourdomain.com/logo.png" alt="Company Logo" style="height: 50px;" />
        <h2 style="color: #0057B7;">Prompt Palace Community</h2>
      </div>
      ${content}
      <hr style="margin: 2rem 0;" />
      <p style="font-size: 0.9rem; color: #888;">If you didn't request this email, you can safely ignore it.</p>
    </div>
  </div>
`;

// OTP Email
export const sendOTPEmail = async (email, subject, otp) => {
  const html = emailWrapper(`
    <p>Hello,</p>
    <p>Your OTP for verification is:</p>
    <h2>${otp}</h2>
    <p>This OTP will expire in 10 minutes.</p>
  `);

  try {
    await resend.emails.send({
      from: 'promptpalcommunity@gmail.com',
      to: email,
      subject,
      html,
    });
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Forgot Password Email
export const sendForgotPasswordEmail = async (email, resetToken) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  const html = emailWrapper(`
    <p>Hello,</p>
    <p>We received a request to reset your password. Click the button below to reset it:</p>
    <p><a href="${resetLink}" style="background-color:#0057B7; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Reset Password</a></p>
    <p>This link will expire in 15 minutes.</p>
  `);

  try {
    await resend.emails.send({
      from: 'promptpalcommunity@gmail.com',
      to: email,
      subject: 'Reset Your Password',
      html,
    });
  } catch (error) {
    console.error('Forgot password email failed:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Welcome Email
export const sendWelcomeEmail = async (email, name) => {
  const html = emailWrapper(`
    <p>Hello ${name},</p>
    <p>Welcome to Prompt Palace Community! Your account has been created successfully.</p>
    <p>We're excited to have you on board. If you have any questions, feel free to reach out.</p>
  `);

  try {
    await resend.emails.send({
      from: 'promptpalcommunity@gmail.com',
      to: email,
      subject: 'Welcome to Prompt Palace Community',
      html,
    });
  } catch (error) {
    console.error('Welcome email failed:', error);
    throw new Error('Failed to send welcome email');
  }
};
