import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import config from './config';
import logger from './config/logger';
import { errorHandler } from './common/filters/error-filter';
import { notFoundHandler } from './common/filters/not-found-filter';

import authRoutes from './modules/auth/routes';
import resumeRoutes from './modules/resume/routes';
import profileRoutes from './modules/profile/routes';
import skillGraphRoutes from './modules/skill-graph/routes';
import questionRoutes from './modules/questions/routes';
import sessionRoutes from './modules/sessions/routes';
import revisionRoutes from './modules/revisions/routes';
import projectRoutes from './modules/projects/routes';
import codingRoutes from './modules/coding/routes';
import mockInterviewRoutes from './modules/mock-interviews/routes';
import marketCalibrationRoutes from './modules/market-calibration/routes';
import analyticsRoutes from './modules/analytics/routes';
import webSearchRoutes from './modules/web-search/routes';
import calendarRoutes from './modules/calendar/routes';

// Load environment
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// CORS
app.use(cors({
  origin: config.urls.frontend,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing
app.use(cookieParser());

// Logging
if (config.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/skill-graph', skillGraphRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/revisions', revisionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/coding', codingRoutes);
app.use('/api/mock-interviews', mockInterviewRoutes);
app.use('/api/market-calibration', marketCalibrationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/search', webSearchRoutes);
app.use('/api/calendar', calendarRoutes);

// Swagger (if enabled)
if (config.swagger.enabled) {
  // Would add swagger middleware here
}

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Database connection and server start
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.database.uri, config.database.options);

    logger.info(`Connected to MongoDB at ${config.database.uri}`);

    // Start server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`Server running at http://${config.host}:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API available at http://${config.host}:${config.port}/api`);

      if (config.swagger.enabled) {
        logger.info(`Swagger docs available at http://${config.host}:${config.port}/api-docs`);
      }
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await mongoose.disconnect();
          logger.info('MongoDB connection closed');
          process.exit(0);
        } catch (err) {
          logger.error('Error disconnecting from MongoDB', { error: err });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start server', {
      error: err,
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Export for testing
export { app };

// Start server
startServer();
