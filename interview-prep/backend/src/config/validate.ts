import config from './index';
import { aiBaseURL, hasAI, hasFallbackAI, aiProviderCandidates } from '../common/services/ai-provider';
export function validateProductionConfig() {
  if(config.ai.apiKey || config.ai.model) {
    if(!config.ai.apiKey || !config.ai.model) throw new Error('Configure both AI_API_KEY and AI_MODEL, or leave both empty');
    aiBaseURL();
  }
  if(config.ai.fallback.apiKey || config.ai.fallback.model) {
    if(!hasFallbackAI()) throw new Error('Configure both AI_FALLBACK_API_KEY and AI_FALLBACK_MODEL, or leave both empty');
    if(!hasAI()) throw new Error('AI_FALLBACK_* requires the primary AI_API_KEY and AI_MODEL to be configured');
    aiProviderCandidates(); // validates the fallback provider/base URL
  }
  if (!config.isProduction) { validateLocalConfig(); return; }
  if(config.upload.provider !== 'gridfs') throw new Error('Production resume storage must be MongoDB GridFS; local disk is not persistent on Render/Vercel');
  if(!config.google.clientId || !config.google.clientSecret) throw new Error('Production Google sign-in requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  if(!config.urls.frontend.startsWith('https://')) throw new Error('Production FRONTEND_URL must use HTTPS');
  if(!config.database.uri || config.database.uri.includes('localhost')) throw new Error('Production MONGODB_URI must point to your hosted database');
}

/**
 * Development-only guard. Both failure modes below look like an unrelated
 * outage: a bad PORT binds a random port (so every proxied /api call fails
 * while the log claims a normal start), and an unresolvable Atlas SRV host
 * kills the process with a bare querySrv error. Name the cause instead.
 */
export function validateLocalConfig() {
  if(!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error(
      `Invalid PORT: ${JSON.stringify(process.env.PORT)}. Many shells export PORT=0, which makes the API bind a ` +
      'random port while the frontend rewrites /api to a fixed http://localhost:3001, so every request fails even ' +
      'though the server "started". Start the backend with PORT=3001 (npm run dev does this for you).');
  }
  if(/\.mongodb\.net/.test(config.database.uri)) {
    throw new Error(
      'MONGODB_URI points at an Atlas host that does not resolve from this machine, so the backend exits at ' +
      'startup with querySrv ECONNREFUSED. For local work set ' +
      'MONGODB_URI="mongodb://localhost:27017/interview-prep-dev" (npm run dev does this for you).');
  }
}
