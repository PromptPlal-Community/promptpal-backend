import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/userModel.js";

dotenv.config();

// Use the EXACT URL - don't rely on environment variables for debugging

console.log('=== GOOGLE OAUTH CONFIGURATION ===');
console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Present' : '✗ Missing');
console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Present' : '✗ Missing');
console.log('Callback URL:', process.env.GOOGLE_CALLBACK_URL);
console.log('==================================');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        console.log('✅ Google authentication successful for:', profile.emails[0].value);
        
        const email = profile.emails[0].value;
        let user = await User.findOne({ googleId: profile.id });
        
        if (user) {
          console.log('✅ Existing Google user found');
          return done(null, user);
        }
              
        user = await User.findOne({ email: email });
        if (user) {
          console.log('✅ Linking Google to existing user');
          user.googleId = profile.id;
          user.avatar = profile.photos[0].value;
          user.isEmailVerified = true;
          user.authMethod = 'google';
          await user.save();
          return done(null, user);
        }

        // Create new user
        const baseUsername = email.split('@')[0];
        const uniqueUsername = `${baseUsername}_${profile.id.substring(0, 8)}`;
        
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: email,
          username: uniqueUsername,
          avatar: profile.photos[0].value,
          isEmailVerified: true,
          authMethod: 'google'
        });

        console.log('✅ New Google user created');
        return done(null, user);
      } catch (err) {
        console.error('❌ Google Strategy Error:', err);
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