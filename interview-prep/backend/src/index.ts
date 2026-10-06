import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import config from './config';
import { rateLimiter } from './common/middleware/rate-limit';
import { requestIdMiddleware } from './common/middleware/request-id';
import { runWithRequestContext } from './common/logging/request-context';
import { safeDbTarget, redactSecrets } from './common/logging/redact';
import { validateProductionConfig } from './config/validate';
import logger from './config/logger';
import { errorHandler } from './common/filters/error-filter';
import { notFoundHandler } from './common/filters/not-found-filter';

import authRoutes from './modules/auth/routes';
import resumeRoutes from './modules/resume/routes';
import { ensureMultiResumeIndexes } from './modules/resume/resume-indexes';
import { seedAllCodingProblems } from './scripts/seed-coding-questions';
import { seedSystemDesignQuestions } from './scripts/seed-system-design-questions';
import onboardingRoutes from './modules/profile/onboarding.routes';
import profileRoutes from './modules/profile/routes';
import skillGraphRoutes from './modules/skill-graph/routes';
import questionRoutes from './modules/questions/routes';
import sessionRoutes from './modules/sessions/routes';
import revisionRoutes from './modules/revisions/routes';
import projectRoutes from './modules/projects/routes';
import codingRoutes from './modules/coding/routes';
import interviewerRoutes from './modules/mock-interviews/interviewer.routes';
import mockInterviewRoutes from './modules/mock-interviews/routes';
import marketCalibrationRoutes from './modules/market-calibration/routes';
import analyticsRoutes from './modules/analytics/routes';
import webSearchRoutes from './modules/web-search/routes';
import calendarRoutes from './modules/calendar/routes';
import trackerRoutes from './modules/tracker/routes';
import plannerRoutes from './modules/planner/routes';
import topicPracticeRoutes from './modules/topics/routes';



import './modules/coding/coding-problem.model';
import './modules/projects/project.model';
import './modules/mock-interviews/mock-interview.model';
import './modules/market-calibration/market-calibration.model';
import './modules/analytics/progress-analytics.model';
import feedbackRoutes from './modules/questions/feedback.routes';
import adminRoutes from './modules/questions/admin.routes';
const app = express();
app.set('trust proxy', config.trustProxyHops);
app.set('etag', false);

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

// Prevent browser caching of API responses
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// Correlation context + request ID. Accept an inbound X-Request-ID (so a
// frontend failure and the corresponding Render log line share the same id),
// otherwise generate one. Wrap the API stack in AsyncLocalStorage so every
// log line in this request carries requestId/method/route/userId. This runs
// before body parsing so even a malformed-JSON rejection is correlated.
app.use((req, res, next) => {
  requestIdMiddleware(req as any, res, () => {
    runWithRequestContext({
      requestId: (req as any).requestId,
      method: req.method,
      route: req.path,
    }, next);
  });
});

// CORS
app.use(cors({
  origin: config.urls.frontend,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing
app.use(cookieParser());

// Enforce origin on browser mutations (including login) to prevent CSRF.
app.use((req, res, next) => {
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin && origin !== config.urls.frontend || !origin && req.get('sec-fetch-site') === 'cross-site') {
      return res.status(403).json({ success: false, error: { message: 'Untrusted request origin' } });
    }
  }
  next();
});
app.use('/api', (req, res, next) => req.path === '/health' ? next() : rateLimiter(req, res, next));

// One leveled per-request completion log (INFO for 2xx, WARN for 4xx, ERROR for
// 5xx) with correlation. Never logs OAuth codes, states, verification/reset
// tokens or query strings; only the path is recorded.
if (!config.isTest) {
  app.use((req, res, next) => {
    const start = Date.now();
    // Capture routing-independent values now: inside a matched route req.url is
    // rewritten to the mount-relative sub-path (/list), so reading it at
    // response time would hide which API was called.
    const method = req.method;
    const safePath = (req.originalUrl || req.path).split('?')[0];
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      logger[level](`${method} ${safePath} ${status} ${duration}ms`,
        {
          module: 'http', route: safePath, method, status, duration,
          requestId: (req as any).requestId || undefined,
          // undefined lets the request-scoped context supply the authenticated user.
          userId: (req as any).userId || undefined,
        });
    });
    next();
  });
}

// Health check
app.get(['/health','/api/health'], (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'healthy' : 'unavailable',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Mongoose connection events — visible in Render without exposing credentials.
const dbHost = safeDbTarget(config.database.uri);
mongoose.connection.on('connected', () => logger.info('MongoDB connected', { module: 'db', host: dbHost }));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected', { module: 'db', host: dbHost }));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected', { module: 'db', host: dbHost }));
mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', { module: 'db', host: dbHost, error: err instanceof Error ? err.message : String(err) }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/profile', onboardingRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/skill-graph', skillGraphRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/revisions', revisionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/coding', codingRoutes);
app.use('/api/mock-interviews', interviewerRoutes);
app.use('/api/mock-interviews', mockInterviewRoutes);
app.use('/api/market-calibration', marketCalibrationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/search', webSearchRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/topics', topicPracticeRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Database connection and server start
export async function startServer() {
  try {
    validateProductionConfig();
    // Connect to MongoDB
    await mongoose.connect(config.database.uri, config.database.options);
    await ensureMultiResumeIndexes();
    try {
      const seeded = await seedAllCodingProblems();
      logger.info('Curated coding bank initialized', seeded);
    } catch (error) {
      // The app can still serve other practice modes; keep startup resilient,
      // while making the failed repair visible to operators.
      logger.error('Could not initialize curated coding bank', {
        module: 'job', job: 'seed-coding-bank',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    try {
      const seeded = await seedSystemDesignQuestions();
      logger.info('Curated system-design bank initialized', seeded);
    } catch (error) {
      logger.error('Could not initialize curated system-design bank', {
        module: 'job', job: 'seed-system-design-bank',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // Optional operational debug: log every MongoDB operation with redaction of
    // secrets. Off by default — only enable temporarily for debugging a specific
    // issue, never in steady-state production.
    if (process.env.LOG_MONGO_QUERIES === 'true') {
      mongoose.set('debug', (...args) => {
        logger.debug('MongoDB op', { module: 'db', op: typeof args[0] === 'string' ? args[0] : undefined, args: args.map(redactSecrets) });
      });
      logger.info('MongoDB query debug logging enabled', { module: 'db', logMongoQueries: true });
    }

    // Start server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`Server running at http://${config.host}:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API available at http://${config.host}:${config.port}/api`);
    });

    // Server-level errors (e.g. EADDRINUSE, permissions) are not caught by the
    // HTTP error middleware; surface them in Render rather than silently exiting.
    server.on('error', (err) => {
      logger.error('HTTP server error', {
        module: 'server', port: config.port, host: config.host,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
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
        logger.error('Forced shutdown after timeout', { module: 'process', signal: signal });
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Process-level crash logging. These are not caught by the Express error
    // middleware, so they must be logged explicitly. unhandledRejection that
    // reaches the top of the event loop still crashes Node, so log + exit.
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception — shutting down', {
        module: 'process', error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      if (mongoose.connection.readyState !== 0) {
        mongoose.disconnect().catch((error) => {
          logger.debug('MongoDB disconnect failed during crash shutdown', {
            module: 'process', error: error instanceof Error ? error.message : String(error),
          });
        });
      }
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      logger.error('Unhandled promise rejection — shutting down', {
        module: 'process', error: message,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      if (mongoose.connection.readyState !== 0) {
        mongoose.disconnect().catch((error) => {
          logger.debug('MongoDB disconnect failed during crash shutdown', {
            module: 'process', error: error instanceof Error ? error.message : String(error),
          });
        });
      }
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to start server', {
      module: 'server',
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

// Export for testing
export { app };

// Start server
if (require.main === module) startServer();
