import dotenv from 'dotenv';
import path from 'path';
import os from 'os';

// One private env file for both apps. Hosting dashboard variables always win.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const env = process.env.NODE_ENV || 'development';
const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

export const config = {
  nodeEnv: env, isDevelopment: env === 'development', isProduction: env === 'production', isTest: env === 'test',
  port: Number(process.env.PORT || 3001),
  host: env === 'production' ? '0.0.0.0' : 'localhost',
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/interview-prep-dev',
    options: { maxPoolSize:10, serverSelectionTimeoutMS:5000, socketTimeoutMS:45000 },
  },
  auth: {
    cookieName: 'interview_prep_session',
    cookieSecure: env === 'production',
    cookieSameSite: 'lax' as const,
    sessionDurationMs: 7 * 86400000,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: frontend + '/api/auth/google/callback',
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'openrouter',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
    customBaseURL: process.env.AI_BASE_URL || '',
    embeddingModel: process.env.AI_EMBEDDING_MODEL || '',
    timeout:60000, retryCount:1, dailyRequestLimit:40,
    // Optional second provider. Used automatically when the primary hits a
    // rate limit, quota, timeout or returns unusable output.
    fallback: {
      provider: process.env.AI_FALLBACK_PROVIDER || 'openrouter',
      apiKey: process.env.AI_FALLBACK_API_KEY || '',
      model: process.env.AI_FALLBACK_MODEL || '',
      customBaseURL: process.env.AI_FALLBACK_BASE_URL || '',
    },
  },
  upload: {
    maxSizeMB:10, allowedTypes:['pdf','docx'],
    storagePath: env === 'test' ? path.join(os.tmpdir(), 'interview-prep-test-'+process.pid) : path.resolve(__dirname, '../../uploads'),
    provider: 'gridfs',
  },
  urls: { frontend },
  search: {
    provider: process.env.SERPAPI_KEY ? 'serpapi' as const : 'duckduckgo' as const,
    serpApiKey:process.env.SERPAPI_KEY || '',
    stackExchange:{enabled:true,key:'',site:'stackoverflow'},
    maxResults:10,maxScrapedPages:4,scrapeTimeoutMs:10000,maxPageBytes:800000,maxContentChars:4000,
    cacheTtlHours:24,respectRobots:true,synthesizeWithAI:true,
  },
  rateLimit:{windowMs:900000,maxRequests:env === 'test' ? 1000 : env === 'production' ? 100 : 500},
};
export default config;
