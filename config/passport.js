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
    
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) return done(null, user);
          
    user = await User.findOne({ email });
    if (user) {
          // Existing email account → link Google
          user.googleId = profile.id;
          user.avatar = profile.photos[0].value;
          await user.save();
          return done(null, user);
    }

user = await User.create({
    googleId: profile.id,
    name: profile.displayName,
    email,
    avatar: profile.photos[0].value
});
          
        done(null, user);
      } catch (err) {
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
