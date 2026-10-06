import config from './index';
import { aiBaseURL, hasAI, hasFallbackAI, aiProviderCandidates } from '../common/services/ai-provider';
export function validateProductionConfig() {
  validateLocalConfig();
  if(config.ai.apiKey || config.ai.model) {
    if(!config.ai.apiKey || !config.ai.model) throw new Error('Configure both AI_API_KEY and AI_MODEL, or leave both empty');
    aiBaseURL();
  }
  aiProviderCandidates(); // validates every configured provider/base URL
  if (!config.isProduction) return;
  if(config.upload.provider !== 'gridfs') throw new Error('Production resume storage must be MongoDB GridFS; local disk is not persistent on Render/Vercel');
  if(!config.google.clientId || !config.google.clientSecret) throw new Error('Production Google sign-in requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  const frontend = new URL(config.urls.frontend);
  if(frontend.protocol !== 'https:' || frontend.username || frontend.password || frontend.pathname !== '/' || frontend.search || frontend.hash)
    throw new Error('Production FRONTEND_URL must be a plain HTTPS origin');
  if(!process.env.MONGODB_URI || /localhost|127\.0\.0\.1|\[::1\]/i.test(config.database.uri))
    throw new Error('Production MONGODB_URI must point to your hosted database');
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
  if (!Number.isInteger(config.trustProxyHops) || config.trustProxyHops < 0 || config.trustProxyHops > 10)
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
}
