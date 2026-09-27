import dotenv from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: env === 'development',
  isProduction: env === 'production',
  isTest: env === 'test',

  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || 'localhost',

  // Database
  database: {
    uri: process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/interview-prep',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    cookieName: process.env.SESSION_COOKIE_NAME || 'interview_prep_session',
    cookieSecure: process.env.NODE_ENV === 'production' ? true : (process.env.SESSION_COOKIE_SECURE === 'true'),
    cookieSameSite: (process.env.SESSION_COOKIE_SAME_SITE || 'lax') as 'lax' | 'strict' | 'none',
  },

  // Email
  email: {
    provider: process.env.EMAIL_PROVIDER || 'ethereal',
    from: process.env.EMAIL_FROM || 'noreply@interviewprep.dev',
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  },

  // AI Providers
  ai: {
    defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'openai',
    embeddingProvider: process.env.AI_EMBEDDING_PROVIDER || 'openai',
    embeddingModel: process.env.AI_EMBEDDING_MODEL || 'text-embedding-ada-002',
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000', 10),
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
        retryCount: parseInt(process.env.OPENAI_RETRY_COUNT || '3', 10),
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-pro',
      },
      nvidia: {
        apiKey: process.env.NVIDIA_API_KEY || '',
        model: process.env.NVIDIA_MODEL || 'playground-llama3',
      },
      custom: {
        providerUrl: process.env.CUSTOM_AI_PROVIDER_URL || '',
        apiKey: process.env.CUSTOM_AI_API_KEY || '',
      },
    },
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Web Search / Scraper (used by the search module to find Q&A on the web)
  search: {
    // 'auto' -> serpapi if SERPAPI_KEY is set, otherwise free DuckDuckGo HTML search
    provider: (process.env.SEARCH_PROVIDER || 'auto') as 'auto' | 'serpapi' | 'duckduckgo' | 'none',
    serpApiKey: process.env.SERPAPI_KEY || '',
    stackExchange: {
      enabled: process.env.SEARCH_STACKEXCHANGE_ENABLED !== 'false',
      key: process.env.STACKEXCHANGE_KEY || '',
      site: process.env.STACKEXCHANGE_SITE || 'stackoverflow',
    },
    maxResults: parseInt(process.env.SEARCH_MAX_RESULTS || '10', 10),
    maxScrapedPages: parseInt(process.env.SEARCH_MAX_SCRAPED_PAGES || '4', 10),
    scrapeTimeoutMs: parseInt(process.env.SEARCH_SCRAPE_TIMEOUT_MS || '10000', 10),
    maxPageBytes: parseInt(process.env.SEARCH_MAX_PAGE_BYTES || '800000', 10),
    maxContentChars: parseInt(process.env.SEARCH_MAX_CONTENT_CHARS || '4000', 10),
    cacheTtlHours: parseInt(process.env.SEARCH_CACHE_TTL_HOURS || '24', 10),
    respectRobots: process.env.SEARCH_RESPECT_ROBOTS !== 'false',
    synthesizeWithAI: process.env.SEARCH_AI_SYNTHESIS !== 'false',
  },

  // Vector Search
  vectorSearch: {
    enabled: process.env.VECTOR_SEARCH_ENABLED === 'true',
    indexName: process.env.VECTOR_SEARCH_INDEX || 'question_embeddings',
  },

  // File Upload
  upload: {
    maxSizeMB: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10),
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,docx').split(','),
    storagePath: process.env.UPLOAD_STORAGE_PATH || './uploads',
  },

  // URLs
  urls: {
    frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
    backend: process.env.BACKEND_URL || 'http://localhost:3001',
  },

  // Feature Flags
  features: {
    emailVerification: process.env.EMAIL_VERIFICATION_ENABLED !== 'false',
    notifications: process.env.NOTIFICATIONS_ENABLED !== 'false',
    marketCalibration: process.env.MARKET_CALIBRATION_ENABLED !== 'false',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Swagger
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    username: process.env.SWAGGER_USERNAME || '',
    password: process.env.SWAGGER_PASSWORD || '',
  },
};

export default config;
