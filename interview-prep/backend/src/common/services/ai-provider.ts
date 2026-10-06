import OpenAI from 'openai';
import config from '../../config';
import logger from '../../config/logger';

// Kept for compatibility with diagnostics/tests from the earlier two-provider
// implementation. Provider order is now always configuration order.
let lastServedProvider: string | null = null;
export function setActiveProvider(provider: string | null): void { lastServedProvider = provider; }
export function getActiveProvider(): string | null { return lastServedProvider; }

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
  // OpenAI-compatible gateways that are not one of the named providers above.
  tokenrouter:'https://api.tokenrouter.com/v1',
};

function providerBaseURL(provider: string, customBaseURL = ''):string {
  if(provider === 'custom') {
    const url=new URL(customBaseURL);
    if(url.protocol !== 'https:' || url.username || url.password) throw new Error('Custom AI_BASE_URL must be HTTPS without credentials');
    return url.toString();
  }
  if(!endpoints[provider]) throw new Error(
    'AI_PROVIDER must be openrouter, gemini, openai, tokenrouter or custom; got "'+provider+'"');
  return endpoints[provider];
}

export function aiBaseURL():string {
  return providerBaseURL(config.ai.provider, config.ai.customBaseURL);
}

export function hasAI():boolean { return Boolean(config.ai.apiKey && config.ai.model); }

/** True when at least one valid primary or fallback provider can serve requests. */
export function hasAnyAI():boolean { return aiProviderCandidates().length > 0; }

// A fallback provider is usable when both its key and model are set, and it
// is not merely a copy of the primary.
export function hasFallbackAI():boolean {
  return Boolean(config.ai.fallback.apiKey && config.ai.fallback.model) &&
    (config.ai.fallback.provider !== config.ai.provider ||
      config.ai.fallback.model !== config.ai.model ||
      (config.ai.fallback.provider === 'custom' && config.ai.fallback.customBaseURL !== config.ai.customBaseURL));
}

type ProviderConfig = { provider:string; apiKey:string; model:string; customBaseURL:string };
const providerConfigs = ():ProviderConfig[] => [
  config.ai,
  config.ai.fallback,
  config.ai.fallback2,
  config.ai.fallback3,
];

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
  const candidates:AIProviderCandidate[] = [];
  for (const item of providerConfigs()) {
    if (!item.apiKey && !item.model) continue;
    if (!item.apiKey && !item.model && item.provider) continue;
    if (!item.apiKey && item.provider === config.ai.provider) continue;
    if (!item.apiKey || !item.model || !item.provider) throw new Error(`Configure provider ${item.provider || 'entry'} with provider, API key, and model`);
    const candidate = { name:item.provider, apiKey:item.apiKey, model:item.model, baseURL:providerBaseURL(item.provider, item.customBaseURL) };
    if (candidates.some(c => c.name === candidate.name && c.model === candidate.model)) continue;
    candidates.push(candidate);
  }
  return candidates;
}

/**
 * Run `fn` against the configured providers in order. Falls back to the next
 * provider when the current one hits a rate limit / quota, is unreachable,
 * errors, or returns output `fn` cannot use (throw to trigger fallback).
 */
export async function withAIFallback<T>(fn:(client:OpenAI, provider:AIProviderCandidate) => Promise<T>,
  preferredProvider?: string):Promise<T> {
  const all = aiProviderCandidates();
  // A caller can pin which provider serves this call, e.g. to give a fallback a
  // turn when the primary's output was technically valid but unusable.
  const candidates = preferredProvider && all.some(c=>c.name === preferredProvider)
    ? [...all].sort((a,b)=>a.name === preferredProvider ? -1 : b.name === preferredProvider ? 1 : 0)
    : all;
  if(!candidates.length) throw new Error('Set AI_API_KEY and AI_MODEL to enable AI');
  let lastError:unknown;
  for(let i=0;i<candidates.length;i++) {
    const candidate = candidates[i];
    const attemptStarted = Date.now();
    try {
      logger.info('[AI_REQUEST] provider attempt', { provider: candidate.name, model: candidate.model, attempt: `${i + 1}/${candidates.length}` });
      const client = new OpenAI({apiKey:candidate.apiKey,baseURL:candidate.baseURL,timeout:config.ai.timeout,maxRetries:config.ai.retryCount});
      const result = await fn(client, candidate);
      if (candidate.name !== config.ai.provider) setActiveProvider(candidate.name);
      logger.info('[AI_SUCCESS] provider attempt', { provider: candidate.name, model: candidate.model, attempt: `${i + 1}/${candidates.length}`, durationMs: Date.now() - attemptStarted });
      return result;
    } catch(error) {
      lastError = error;
      const providerError = error as any;
      logger.warn('[AI_FAILURE] provider attempt', { provider: candidate.name, model: candidate.model,
        attempt: `${i + 1}/${candidates.length}`, status: providerError?.status, code: providerError?.code,
        error: providerError instanceof Error ? providerError.message : String(providerError),
        timeout: providerError?.name === 'APIConnectionTimeoutError' || /timeout/i.test(String(providerError?.message || '')),
        rateLimited: providerError?.status === 429, durationMs: Date.now() - attemptStarted });
      if(i < candidates.length - 1) {
        logger.warn('[AI_FALLBACK] AI provider failed; trying next provider', {
          failedProvider: candidate.name, failedModel: candidate.model,
          attempt: `${i + 1}/${candidates.length}`,
          error: error instanceof Error ? error.message : String(error),
          nextProvider: candidates[i + 1].name,
        });
      }
    }
  }
  throw lastError;
}
