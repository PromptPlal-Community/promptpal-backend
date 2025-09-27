import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import promptRoutes from './routes/promptRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import connectDB from './config/db.js';
import { welcomeMessage } from './controllers/authController.js';
import { Router } from 'express';

dotenv.config();

const app = express();

// === Middleware ===
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);

app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 100,
  message: 'Too many requests from this IP, please try again after 10 minutes',
});

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// === Routes ===
const router = express.Router();
router.get('/', welcomeMessage);
app.use('/api/auth', limiter, authRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/subscriptions', subscriptionRoutes);


// === Error Handlers ===
app.use(notFound);
app.use(errorHandler);

// === Start Server after DB Connect ===
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`✅ Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });
