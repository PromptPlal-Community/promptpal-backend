// config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/userModel.js";

dotenv.config();

// Use the exact callback URL from environment variables
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
        console.log('Google Profile Received:', profile);
        
        // Extract email from profile
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        
        if (!email) {
          return done(new Error('No email found in Google profile'));
        }
    
        let user = await User.findOne({ googleId: profile.id });
        
        if (user) {
          console.log('Existing Google user found:', user.email);
          return done(null, user);
        }
              
        // Check if user exists with this email
        user = await User.findOne({ email: email });
        if (user) {
          console.log('Linking Google to existing user:', user.email);
          user.googleId = profile.id;
          user.avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : user.avatar;
          user.isEmailVerified = true;
          user.authMethod = 'google';
          await user.save();
          return done(null, user);
        }

        // Generate unique username
        const baseUsername = email.split('@')[0];
        const uniqueUsername = `${baseUsername}_${profile.id.substring(0, 8)}`;
        
        // Create new user
        console.log('Creating new Google user:', email);
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: email,
          username: uniqueUsername,
          avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
          isEmailVerified: true,
          authMethod: 'google'
        });
              
        done(null, user);
      } catch (err) {
        console.error('Google Strategy Error:', err);
        done(err, null);
      }
    }
  )
);

// ... rest of passport configuration
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