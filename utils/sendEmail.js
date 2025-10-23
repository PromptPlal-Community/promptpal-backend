import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email wrapper for consistent branding
const emailWrapper = (content) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #270450 0%, #764ba2 100%); padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Prompt Palace Community</h1>
    </div>
    <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e1e1e1;">
      ${content}
    </div>
    <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p>If you didn't request this email, you can safely ignore it.</p>
      <p>&copy; ${new Date().getFullYear()} Prompt Palace Community. All rights reserved.</p>
    </div>
  </div>
`;

// Generic email sending function using SendGrid Web API
export async function sendEmail(to, subject, html, text = '') {
  try {
    console.log(`📧 Sending email to: ${to}`);
    
    const msg = {
      to: to,
      from: {
        name: 'Prompt Palace Community',
        email: process.env.SENDGRID_FROM_EMAIL || 'promptpalcommunity@gmail.com'
      },
      subject: subject,
      text: text,
      html: html,
    };

    const response = await sgMail.send(msg);
    console.log('✅ Email sent successfully via SendGrid API');
    console.log('📧 Status Code:', response[0].statusCode);
    
    return {
      success: true,
      statusCode: response[0].statusCode,
      headers: response[0].headers,
    };
  } catch (error) {
    console.error('❌ Error sending email via SendGrid API:', error);
    
    if (error.response) {
      console.error('SendGrid API Response:', error.response.body);
    }
    
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// OTP Email
export const sendOTPEmail = async (to, otp) => {
  const subject = 'Your Verification Code - Prompt Palace';
  const html = emailWrapper(`
    <h2 style="color: #333; margin-top: 0;">Email Verification</h2>
    <p>Hello,</p>
    <p>Your verification code for Prompt Palace Community is:</p>
    <div style="text-align: center; margin: 30px 0;">
      <div style="font-size: 32px; font-weight: bold; color: #270450; letter-spacing: 5px; background: #f0f0f0; padding: 15px; border-radius: 8px; display: inline-block;">
        ${otp}
      </div>
    </div>
    <p>This code will expire in <strong>10 minutes</strong>.</p>
    <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
  `);

  const text = `Your Prompt Palace verification code is: ${otp}. This code expires in 10 minutes.`;

  return await sendEmail(to, subject, html, text);
};

// Forgot Password Email
export const sendForgotPasswordEmail = async (to, resetToken) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password?resetToken=${resetToken}`;
  const subject = 'Reset Your Password - Prompt Palace';
  
  const html = emailWrapper(`
    <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
    <p>Hello,</p>
    <p>We received a request to reset your password for your Prompt Palace Community account.</p>
    <p>Click the button below to reset your password:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background-color: #270450; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
        Reset Password
      </a>
    </div>
    <p>Or copy and paste this link in your browser:</p>
    <p style="background: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 14px;">
      ${resetLink}
    </p>
    <p>This link will expire in <strong>15 minutes</strong>.</p>
    <p style="color: #666;">If you didn't request a password reset, please ignore this email.</p>
  `);

  const text = `Reset your Prompt Palace password: ${resetLink}. This link expires in 15 minutes.`;

  return await sendEmail(to, subject, html, text);
};

// Welcome Email
export const sendWelcomeEmail = async (to, name) => {
  const subject = 'Welcome to Prompt Palace Community!';
  
  const html = emailWrapper(`
    <h2 style="color: #333; margin-top: 0;">Welcome to Prompt Palace Community!</h2>
    <p>Hello ${name},</p>
    <p>We're thrilled to welcome you to the Prompt Palace Community! Your account has been successfully created and you're now part of our growing community.</p>
    
    <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #270450;">What's Next?</h3>
      <ul style="margin-bottom: 0;">
        <li>Explore our community features</li>
        <li>Connect with other members</li>
        <li>Discover amazing prompts and resources</li>
      </ul>
    </div>
    
    <p>If you have any questions or need assistance, don't hesitate to reply to this email.</p>
    <p>Happy prompting! 🎉</p>
  `);

  const text = `Welcome to Prompt Palace Community, ${name}! We're excited to have you on board. Explore our community features and start connecting with other members.`;

  return await sendEmail(to, subject, html, text);
};

// Subscription Email
export const sendSubscriptionEmail = async (to, plan, name = 'there') => {
  const subject = `Welcome to ${plan} Plan - Prompt Palace`;
  
  const html = emailWrapper(`
    <h2 style="color: #333; margin-top: 0;">Subscription Confirmed!</h2>
    <p>Hello ${name},</p>
    <p>Thank you for subscribing to our <strong>${plan}</strong> plan! We're excited to have you on board and can't wait to see what you'll create.</p>
    
    <div style="background: #f0f8f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #270450;">Your ${plan} Plan Includes:</h3>
      <ul style="margin-bottom: 0;">
        <li>Access to premium prompts</li>
        <li>Enhanced community features</li>
        <li>Priority support</li>
        <li>And much more!</li>
      </ul>
    </div>
    
    <p>Your subscription is now active. You'll receive a separate receipt for your payment.</p>
    <p>Need help? Our support team is here for you!</p>
  `);

  const text = `Thank you for subscribing to the ${plan} plan at Prompt Palace Community! Your subscription is now active and you have access to all premium features.`;

  return await sendEmail(to, subject, html, text);
};

// Cancellation Email
export const sendCancellationEmail = async (to, plan, name = 'there') => {
  const subject = `We're Sorry to See You Go - Prompt Palace`;
  
  const html = emailWrapper(`
    <h2 style="color: #333; margin-top: 0;">Subscription Cancelled</h2>
    <p>Hello ${name},</p>
    <p>Your subscription to the <strong>${plan}</strong> plan has been cancelled.</p>
    <p>We're genuinely sorry to see you go and would love to understand how we could have served you better.</p>
    
    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #270450;">We'd Love Your Feedback</h3>
      <p>Your experience helps us improve. If you have a moment, please reply to this email and let us know:</p>
      <ul style="margin-bottom: 0;">
        <li>What prompted your decision to cancel?</li>
        <li>How could we have provided a better experience?</li>
        <li>Would you consider returning in the future?</li>
      </ul>
    </div>
    
    <p>You'll continue to have access to your plan features until the end of your billing period.</p>
    <p>Thank you for being part of our community. We hope to see you again!</p>
  `);

  const text = `Your ${plan} subscription at Prompt Palace Community has been cancelled. We're sorry to see you go and would appreciate any feedback about your experience.`;

  return await sendEmail(to, subject, html, text);
};

// Test function
export const testEmailService = async () => {
  try {
    console.log('🧪 Testing SendGrid Web API...');
    
    // Test with your own email
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    
    const result = await sendWelcomeEmail(testEmail, 'Test User');
    
    if (result.success) {
      console.log('✅ SendGrid Web API test passed!');
      console.log('📧 Status Code:', result.statusCode);
    } else {
      console.log('❌ SendGrid Web API test failed');
    }
    
    return result;
  } catch (error) {
    console.error('💥 SendGrid Web API test failed:', error.message);
    throw error;
  }
};

export default {
  sendOTPEmail,
  sendForgotPasswordEmail,
  sendWelcomeEmail,
  sendSubscriptionEmail,
  sendCancellationEmail,
  testEmailService,
  sendEmail
};



// import nodemailer from 'nodemailer';
// import { google } from 'googleapis';
// import dotenv from 'dotenv';

// dotenv.config();

// const oauth2Client = new google.auth.OAuth2(
//   process.env.GOOGLE_CLIENT_ID,
//   process.env.GOOGLE_CLIENT_SECRET
// );

// oauth2Client.setCredentials({
//   refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
//   access_token: process.env.GOOGLE_ACCESS_TOKEN
// });

// async function getAccessToken() {
//   try {
    
//     // Check if token needs refresh
//     if (!oauth2Client.credentials.expiry_date || Date.now() > oauth2Client.credentials.expiry_date - 300000) {
//       const { credentials } = await oauth2Client.refreshAccessToken();
//       oauth2Client.setCredentials(credentials);
      
//       if (credentials.access_token) {
//         process.env.GOOGLE_ACCESS_TOKEN = credentials.access_token;
//       }
      
//       return credentials.access_token;
//     }
    
//     return oauth2Client.credentials.access_token;
//   } catch (error) {
//     console.error('❌ Error refreshing token:', error.message);
//     throw error;
//   }
// }

// async function createTransporter() {
//   try {
//     const accessToken = await getAccessToken();
    
//     if (!accessToken) {
//       throw new Error('No access token available');
//     }

//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         type: 'OAuth2',
//         user: process.env.GMAIL_USER,
//         clientId: process.env.GOOGLE_CLIENT_ID,
//         clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//         refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
//         accessToken: accessToken
//       }
//     });

//     await transporter.verify();
    
//     return transporter;
//   } catch (error) {
//     console.error('❌ Error creating transporter:', error.message);
//     throw error;
//   }
// }

// // Email wrapper for consistent branding
// const emailWrapper = (content) => `
//   <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
//     <div style="background: linear-gradient(135deg, #270450 0%, #764ba2 100%); padding: 20px; text-align: center;">
//       <h1 style="color: white; margin: 0; font-size: 24px;">Prompt Palace Community</h1>
//     </div>
//     <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e1e1e1;">
//       ${content}
//     </div>
//     <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
//       <p>If you didn't request this email, you can safely ignore it.</p>
//       <p>&copy; ${new Date().getFullYear()} Prompt Palace Community. All rights reserved.</p>
//     </div>
//   </div>
// `;

// // Generic email sending function
// export async function sendEmail(to, subject, html, text = '') {
//   try {
//     const transporter = await createTransporter();

//     const mailOptions = {
//       from: {
//         name: 'Prompt Palace Community',
//         address: process.env.GMAIL_USER
//       },
//       to: to,
//       subject: subject,
//       text: text,
//       html: html
//     };

//     console.log(`📧 Sending email to: ${to}`);
//     const result = await transporter.sendMail(mailOptions);
//     console.log('✅ Email sent successfully:', result.messageId);
    
//     return {
//       success: true,
//       messageId: result.messageId,
//       response: result.response
//     };
//   } catch (error) {
//     console.error('❌ Error sending email:', error);
//     throw new Error(`Failed to send email: ${error.message}`);
//   }
// }

// // OTP Email
// export const sendOTPEmail = async (to, otp) => {
//   const subject = 'Your Verification Code - Prompt Palace';
//   const html = emailWrapper(`
//     <h2 style="color: #333; margin-top: 0;">Email Verification</h2>
//     <p>Hello,</p>
//     <p>Your verification code for Prompt Palace Community is:</p>
//     <div style="text-align: center; margin: 30px 0;">
//       <div style="font-size: 32px; font-weight: bold; color: #270450; letter-spacing: 5px; background: #f0f0f0; padding: 15px; border-radius: 8px; display: inline-block;">
//         ${otp}
//       </div>
//     </div>
//     <p>This code will expire in <strong>10 minutes</strong>.</p>
//     <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
//   `);

//   const text = `Your Prompt Palace verification code is: ${otp}. This code expires in 10 minutes.`;

//   return await sendEmail(to, subject, html, text);
// };

// // Forgot Password Email
// export const sendForgotPasswordEmail = async (to, resetToken) => {
//   const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
//   const subject = 'Reset Your Password - Prompt Palace';
  
//   const html = emailWrapper(`
//     <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
//     <p>Hello,</p>
//     <p>We received a request to reset your password for your Prompt Palace Community account.</p>
//     <p>Click the button below to reset your password:</p>
//     <div style="text-align: center; margin: 30px 0;">
//       <a href="${resetLink}" style="background-color: #270450; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
//         Reset Password
//       </a>
//     </div>
//     <p>Or copy and paste this link in your browser:</p>
//     <p style="background: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 14px;">
//       ${resetLink}
//     </p>
//     <p>This link will expire in <strong>15 minutes</strong>.</p>
//     <p style="color: #666;">If you didn't request a password reset, please ignore this email.</p>
//   `);

//   const text = `Reset your Prompt Palace password: ${resetLink}. This link expires in 15 minutes.`;

//   return await sendEmail(to, subject, html, text);
// };

// // Welcome Email
// export const sendWelcomeEmail = async (to, name) => {
//   const subject = 'Welcome to Prompt Palace Community!';
  
//   const html = emailWrapper(`
//     <h2 style="color: #333; margin-top: 0;">Welcome to Prompt Palace Community!</h2>
//     <p>Hello ${name},</p>
//     <p>We're thrilled to welcome you to the Prompt Palace Community! Your account has been successfully created and you're now part of our growing community.</p>
    
//     <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
//       <h3 style="margin-top: 0; color: #270450;">What's Next?</h3>
//       <ul style="margin-bottom: 0;">
//         <li>Explore our community features</li>
//         <li>Connect with other members</li>
//         <li>Discover amazing prompts and resources</li>
//       </ul>
//     </div>
    
//     <p>If you have any questions or need assistance, don't hesitate to reply to this email.</p>
//     <p>Happy prompting! 🎉</p>
//   `);

//   const text = `Welcome to Prompt Palace Community, ${name}! We're excited to have you on board. Explore our community features and start connecting with other members.`;

//   return await sendEmail(to, subject, html, text);
// };

// // Subscription Email
// export const sendSubscriptionEmail = async (to, plan, name = 'there') => {
//   const subject = `Welcome to ${plan} Plan - Prompt Palace`;
  
//   const html = emailWrapper(`
//     <h2 style="color: #333; margin-top: 0;">Subscription Confirmed!</h2>
//     <p>Hello ${name},</p>
//     <p>Thank you for subscribing to our <strong>${plan}</strong> plan! We're excited to have you on board and can't wait to see what you'll create.</p>
    
//     <div style="background: #f0f8f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
//       <h3 style="margin-top: 0; color: #270450;">Your ${plan} Plan Includes:</h3>
//       <ul style="margin-bottom: 0;">
//         <li>Access to premium prompts</li>
//         <li>Enhanced community features</li>
//         <li>Priority support</li>
//         <li>And much more!</li>
//       </ul>
//     </div>
    
//     <p>Your subscription is now active. You'll receive a separate receipt for your payment.</p>
//     <p>Need help? Our support team is here for you!</p>
//   `);

//   const text = `Thank you for subscribing to the ${plan} plan at Prompt Palace Community! Your subscription is now active and you have access to all premium features.`;

//   return await sendEmail(to, subject, html, text);
// };

// // Cancellation Email
// export const sendCancellationEmail = async (to, plan, name = 'there') => {
//   const subject = `We're Sorry to See You Go - Prompt Palace`;
  
//   const html = emailWrapper(`
//     <h2 style="color: #333; margin-top: 0;">Subscription Cancelled</h2>
//     <p>Hello ${name},</p>
//     <p>Your subscription to the <strong>${plan}</strong> plan has been cancelled.</p>
//     <p>We're genuinely sorry to see you go and would love to understand how we could have served you better.</p>
    
//     <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
//       <h3 style="margin-top: 0; color: #270450;">We'd Love Your Feedback</h3>
//       <p>Your experience helps us improve. If you have a moment, please reply to this email and let us know:</p>
//       <ul style="margin-bottom: 0;">
//         <li>What prompted your decision to cancel?</li>
//         <li>How could we have provided a better experience?</li>
//         <li>Would you consider returning in the future?</li>
//       </ul>
//     </div>
    
//     <p>You'll continue to have access to your plan features until the end of your billing period.</p>
//     <p>Thank you for being part of our community. We hope to see you again!</p>
//   `);

//   const text = `Your ${plan} subscription at Prompt Palace Community has been cancelled. We're sorry to see you go and would appreciate any feedback about your experience.`;

//   return await sendEmail(to, subject, html, text);
// };

// // Test function
// export const testEmailService = async () => {
//   try {
//     console.log('🧪 Testing email service...');
    
//     // Test with your own email
//     const testEmail = process.env.GMAIL_USER;
    
//     const result = await sendWelcomeEmail(testEmail, 'Test User');
    
//     if (result.success) {
//       console.log('✅ Email service test passed!');
//       console.log('📧 Message ID:', result.messageId);
//     } else {
//       console.log('❌ Email service test failed');
//     }
    
//     return result;
//   } catch (error) {
//     console.error('💥 Email service test failed:', error);
//     throw error;
//   }
// };



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

