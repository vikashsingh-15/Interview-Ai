import OpenAI from 'openai';
import config from '../../config';

const endpoints:Record<string,string> = {
  openrouter:'https://openrouter.ai/api/v1',
  gemini:'https://generativelanguage.googleapis.com/v1beta/openai/',
  openai:'https://api.openai.com/v1',
};
export function aiBaseURL():string {
  if(config.ai.provider === 'custom') {
    const url=new URL(config.ai.customBaseURL);
    if(url.protocol !== 'https:' || url.username || url.password) throw new Error('Custom AI_BASE_URL must be HTTPS without credentials');
    return url.toString();
  }
  if(!endpoints[config.ai.provider]) throw new Error('AI_PROVIDER must be openrouter, gemini, openai or custom');
  return endpoints[config.ai.provider];
}
export function hasAI():boolean { return Boolean(config.ai.apiKey && config.ai.model); }
export function createAIClient():OpenAI {
  if(!hasAI()) throw new Error('Set AI_API_KEY and AI_MODEL to enable AI');
  return new OpenAI({apiKey:config.ai.apiKey,baseURL:aiBaseURL(),timeout:config.ai.timeout,maxRetries:config.ai.retryCount});
}
