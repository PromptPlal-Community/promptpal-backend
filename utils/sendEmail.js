import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

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

export const sendOTPEmail = async (to, subject, otp) => {
  const html = emailWrapper(`
    <p>Hello,</p>
    <p>Your OTP for verification is:</p>
    <h2>${otp}</h2>
    <p>This OTP will expire in 10 minutes.</p>
  `);

  try {
    const info = await transporter.sendMail({
      from: `"Prompt Palace" <${process.env.EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log("OTP Email sent:", info.messageId);
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Failed to send OTP email");
  }
};

export const sendForgotPasswordEmail = async (to, resetToken) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  const html = emailWrapper(`
    <p>Hello,</p>
    <p>We received a request to reset your password. Click below:</p>
    <p><a href="${resetLink}" style="background-color:#0057B7; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Reset Password</a></p>
    <p>This link will expire in 15 minutes.</p>
  `);

  try {
    await transporter.sendMail({
      from: `"Prompt Palace" <${process.env.EMAIL}>`,
      to,
      subject: "Reset Your Password",
      html,
    });
    console.log("Password reset email sent.");
  } catch (error) {
    console.error("Forgot password email failed:", error);
    throw new Error("Failed to send password reset email");
  }
};

export const sendWelcomeEmail = async (to, name) => {
  const html = emailWrapper(`
    <p>Hello ${name},</p>
    <p>Welcome to Prompt Palace Community! Your account has been created successfully.</p>
  `);

  try {
    await transporter.sendMail({
      from: `"Prompt Palace" <${process.env.EMAIL}>`,
      to,
      subject: "Welcome to Prompt Palace Community",
      html,
    });
    console.log("Welcome email sent.");
  } catch (error) {
    console.error("Welcome email failed:", error);
    throw new Error("Failed to send welcome email");
  }
};

export const sendSubscriptionEmail = async (to, plan) => { 
  const html = emailWrapper(`
    <p>Hello,</p>
    <p>Thank you for subscribing to the ${plan} plan! We're excited to have you on board.</p>
  `);

  try {
    await transporter.sendMail({
      from: `"Prompt Palace" <${process.env.EMAIL}>`,
      to,
      subject: "Subscription Confirmation",
      html,
    });
    console.log("Subscription email sent.");
  } catch (error) {
    console.error("Subscription email failed:", error);
    throw new Error("Failed to send subscription email");
  }
};

export const sendCancellationEmail = async (to, plan) => {
  const html = emailWrapper(`
    <p>Hello,</p>
    <p>Your subscription to the ${plan} plan has been cancelled. We're sorry to see you go!</p>
    <p>If you have any feedback or questions, feel free to reply to this email.</p>
  `);

  try {
    await transporter.sendMail({
      from: `"Prompt Palace" <${process.env.EMAIL}>`,
      to,
      subject: "Subscription Cancelled",
      html,
    });
    console.log("Cancellation email sent.");
  } catch (error) {
    console.error("Cancellation email failed:", error);
    throw new Error("Failed to send cancellation email");
  }
};

// Add more email functions as needed




// Email configuration using Resend for domain verification
// import { Resend } from 'resend';
// import dotenv from 'dotenv';
// dotenv.config();
// const resend = new Resend(process.env.RESEND_API_KEY);

// // Email wrapper for consistent branding
// const emailWrapper = (content) => `
//   <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
//     <div style="padding: 1rem; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: auto;">
//       <div style="text-align: center; margin-bottom: 1rem;">
//         <img src="https://yourdomain.com/logo.png" alt="Company Logo" style="height: 50px;" />
//         <h2 style="color: #0057B7;">Prompt Palace Community</h2>
//       </div>
//       ${content}
//       <hr style="margin: 2rem 0;" />
//       <p style="font-size: 0.9rem; color: #888;">If you didn't request this email, you can safely ignore it.</p>
//     </div>
//   </div>
// `;

// // OTP Email
// export const sendOTPEmail = async (email, subject, otp) => {
//   const html = emailWrapper(`
//     <p>Hello,</p>
//     <p>Your OTP for verification is:</p>
//     <h2>${otp}</h2>
//     <p>This OTP will expire in 10 minutes.</p>
//   `);

//   try {
//     await resend.emails.send({
//       from: 'promptpalcommunity@gmail.com',
//       to: email,
//       subject,
//       html,
//     });
//   } catch (error) {
//     console.error('Email sending failed:', error);
//     throw new Error('Failed to send OTP email');
//   }
// };

// // Forgot Password Email
// export const sendForgotPasswordEmail = async (email, resetToken) => {
//   const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
//   const html = emailWrapper(`
//     <p>Hello,</p>
//     <p>We received a request to reset your password. Click the button below to reset it:</p>
//     <p><a href="${resetLink}" style="background-color:#0057B7; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Reset Password</a></p>
//     <p>This link will expire in 15 minutes.</p>
//   `);

//   try {
//     await resend.emails.send({
//       from: 'promptpalcommunity@gmail.com',
//       to: email,
//       subject: 'Reset Your Password',
//       html,
//     });
//   } catch (error) {
//     console.error('Forgot password email failed:', error);
//     throw new Error('Failed to send password reset email');
//   }
// };

// // Welcome Email
// export const sendWelcomeEmail = async (email, name) => {
//   const html = emailWrapper(`
//     <p>Hello ${name},</p>
//     <p>Welcome to Prompt Palace Community! Your account has been created successfully.</p>
//     <p>We're excited to have you on board. If you have any questions, feel free to reach out.</p>
//   `);

//   try {
//     await resend.emails.send({
//       from: 'promptpalcommunity@gmail.com',
//       to: email,
//       subject: 'Welcome to Prompt Palace Community',
//       html,
//     });
//   } catch (error) {
//     console.error('Welcome email failed:', error);
//     throw new Error('Failed to send welcome email');
//   }
// };

