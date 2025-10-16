import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/userModel.js";

dotenv.config();

console.log('🔧 Google OAuth Configuration:');
console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Present' : '❌ Missing');
console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Present' : '❌ Missing');
console.log('Callback URL:', process.env.GOOGLE_CALLBACK_URL);
console.log('JWT Secret:', process.env.JWT_SECRET ? '✅ Present' : '❌ Missing');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
      scope: ['profile', 'email']
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        console.log('✅ Google profile received successfully');
        
        if (!profile.emails || !profile.emails[0]) {
          return done(new Error('No email in Google profile'));
        }

        const email = profile.emails[0].value;
        console.log('🔍 Looking for user with email:', email);

        // Check for existing Google user
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          console.log('✅ Found existing Google user');
          return done(null, user);
        }

        // Check for existing email user
        user = await User.findOne({ email: email });
        if (user) {
          console.log('✅ Linking Google to existing user');
          user.googleId = profile.id;
          user.avatar = profile.photos?.[0]?.value || user.avatar;
          user.isEmailVerified = true;
          user.authMethod = 'google';
          await user.save();
          return done(null, user);
        }

        // Create new user
        console.log('✅ Creating new Google user');
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
        console.error('❌ Passport strategy error:', err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;