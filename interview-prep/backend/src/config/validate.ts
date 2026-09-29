import config from './index';
import { aiBaseURL } from '../common/services/ai-provider';
export function validateProductionConfig() {
  if(config.ai.apiKey || config.ai.model) {
    if(!config.ai.apiKey || !config.ai.model) throw new Error('Configure both AI_API_KEY and AI_MODEL, or leave both empty');
    aiBaseURL();
  }
  if (!config.isProduction) return;
  if(!config.google.clientId || !config.google.clientSecret) throw new Error('Production Google sign-in requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  if(!config.urls.frontend.startsWith('https://')) throw new Error('Production FRONTEND_URL must use HTTPS');
  if(!config.database.uri || config.database.uri.includes('localhost')) throw new Error('Production MONGODB_URI must point to your hosted database');
}
