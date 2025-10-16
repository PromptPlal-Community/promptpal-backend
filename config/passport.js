import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/userModel.js"
dotenv.config();

passport.authenticate('google', { session: false });

// REGISTRATION VIA GOOGLE AUTH
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google Profile:', profile); // Debug log
        
        // Extract email from profile - FIXED THIS LINE
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        
        if (!email) {
          return done(new Error('No email found in Google profile'));
        }
    
        let user = await User.findOne({ googleId: profile.id });
        
        if (user) return done(null, user);
              
        user = await User.findOne({ email: email }); // Use the extracted email
        if (user) {
          // Existing email account → link Google
          user.googleId = profile.id;
          user.avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : user.avatar;
          await user.save();
          return done(null, user);
        }

        // Create new user with Google data
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: email, // Use the extracted email
          avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
          isEmailVerified: true, // Google emails are verified
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