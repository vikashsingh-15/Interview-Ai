import OpenAI from 'openai';
import config from '../../config';
import logger from '../../config/logger';

export interface AIProviderCandidate {
  name: string;
  apiKey: string;
  model: string;
  baseURL: string;
}

const endpoints:Record<string,string> = {
  openrouter:'https://openrouter.ai/api/v1',
  gemini:'https://generativelanguage.googleapis.com/v1beta/openai/',
  openai:'https://api.openai.com/v1',
};

// Cache the last serving provider when a fallback actually took over, so the
// primary (e.g. an exhausted free-tier quota) is not retried on every request.
let activeOverride: string | null = null;

export function setActiveProvider(provider: string | null): void {
  activeOverride = provider;
}

export function getActiveProvider(): string | null {
  return activeOverride;
}

function providerBaseURL(provider: string):string {
  if(provider === 'custom') {
    const url=new URL(provider === config.ai.provider ? config.ai.customBaseURL : config.ai.fallback.customBaseURL);
    if(url.protocol !== 'https:' || url.username || url.password) throw new Error('Custom AI_BASE_URL must be HTTPS without credentials');
    return url.toString();
  }
  if(!endpoints[provider]) throw new Error('AI_PROVIDER must be openrouter, gemini, openai or custom');
  return endpoints[provider];
}

export function aiBaseURL():string {
  return providerBaseURL(config.ai.provider);
}

export function hasAI():boolean { return Boolean(config.ai.apiKey && config.ai.model); }

// A fallback provider is usable when both its key and model are set, and it
// is not merely a copy of the primary.
export function hasFallbackAI():boolean {
  return Boolean(config.ai.fallback.apiKey && config.ai.fallback.model) &&
    (config.ai.fallback.provider !== config.ai.provider ||
      config.ai.fallback.model !== config.ai.model ||
      (config.ai.fallback.provider === 'custom' && config.ai.fallback.customBaseURL !== config.ai.customBaseURL));
}

export function createAIClient(provider?:string):OpenAI {
  const name = provider ?? config.ai.provider;
  if(name === config.ai.provider) {
    if(!hasAI()) throw new Error('Set AI_API_KEY and AI_MODEL to enable AI');
    return new OpenAI({apiKey:config.ai.apiKey,baseURL:providerBaseURL(name),timeout:config.ai.timeout,maxRetries:config.ai.retryCount});
  }
  if(name === config.ai.fallback.provider) {
    if(!config.ai.fallback.apiKey || !config.ai.fallback.model) throw new Error('Set AI_FALLBACK_API_KEY and AI_FALLBACK_MODEL to enable the fallback provider');
    return new OpenAI({apiKey:config.ai.fallback.apiKey,baseURL:providerBaseURL(name),timeout:config.ai.timeout,maxRetries:config.ai.retryCount});
  }
  throw new Error('Set AI_API_KEY and AI_MODEL to enable AI');
}

/**
 * Ordered provider candidates: primary first, then the optional fallback.
 * When a fallback has taken over (sticky), it is tried first so an exhausted
 * primary is not re-attempted on every call.
 */
export function aiProviderCandidates():AIProviderCandidate[] {
  const primary:AIProviderCandidate = {
    name: config.ai.provider, apiKey: config.ai.apiKey, model: config.ai.model,
    baseURL: providerBaseURL(config.ai.provider),
  };
  if(!hasFallbackAI()) return hasAI() ? [primary] : [];
  const fallback:AIProviderCandidate = {
    name: config.ai.fallback.provider, apiKey: config.ai.fallback.apiKey, model: config.ai.fallback.model,
    baseURL: providerBaseURL(config.ai.fallback.provider),
  };
  if(!hasAI()) return [fallback];
  return activeOverride && activeOverride !== config.ai.provider ? [fallback, primary] : [primary, fallback];
}

/**
 * Run `fn` against the configured providers in order. Falls back to the next
 * provider when the current one hits a rate limit / quota, is unreachable,
 * errors, or returns output `fn` cannot use (throw to trigger fallback).
 */
export async function withAIFallback<T>(fn:(client:OpenAI, provider:AIProviderCandidate) => Promise<T>):Promise<T> {
  const candidates = aiProviderCandidates();
  if(!candidates.length) throw new Error('Set AI_API_KEY and AI_MODEL to enable AI');
  let lastError:unknown;
  for(let i=0;i<candidates.length;i++) {
    const candidate = candidates[i];
    try {
      const client = new OpenAI({apiKey:candidate.apiKey,baseURL:candidate.baseURL,timeout:config.ai.timeout,maxRetries:config.ai.retryCount});
      const result = await fn(client, candidate);
      if(candidate.name !== config.ai.provider) setActiveProvider(candidate.name);
      return result;
    } catch(error) {
      lastError = error;
      if(i < candidates.length - 1) {
        logger.warn('AI provider failed; trying next provider', {
          failedProvider: candidate.name, failedModel: candidate.model,
          error: error instanceof Error ? error.message : String(error),
          nextProvider: candidates[i + 1].name,
        });
      }
    }
  }
  throw lastError;
}
