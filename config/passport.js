// config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/userModel.js";
import crypto from "crypto";

dotenv.config();

// Generate cryptographically secure random state
const generateState = () => {
  return crypto.randomBytes(32).toString('hex');
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
      scope: ['profile', 'email'],
      state: true // Enable state parameter for CSRF protection
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Validate profile data
        if (!profile.emails || !profile.emails[0] || !profile.emails[0].verified) {
          return done(new Error('Email not verified by Google'));
        }

        const email = profile.emails[0].value;
        
        // Check for existing Google user
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          return done(null, user);
        }

        // Check for existing email user
        user = await User.findOne({ email: email });
        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id;
          user.avatar = profile.photos?.[0]?.value || user.avatar;
          user.isEmailVerified = true;
          user.authMethod = 'google';
          await user.save();
          return done(null, user);
        }

        // Create new user with validated data
        const baseUsername = email.split('@')[0];
        const uniqueUsername = `${baseUsername}_${profile.id.substring(0, 8)}`;
        
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: email,
          username: uniqueUsername,
          avatar: profile.photos?.[0]?.value || '',
          isEmailVerified: true,
          authMethod: 'google'
        });

        return done(null, user);
      } catch (err) {
        console.error('Passport strategy error:', err);
        return done(err, null);
      }
    }
  )
);

export { generateState };
export default passport;