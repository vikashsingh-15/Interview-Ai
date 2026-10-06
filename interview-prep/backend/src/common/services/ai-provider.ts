import OpenAI from 'openai';
import config from '../../config';
import logger from '../../config/logger';
import { ZodError } from 'zod';

// Kept for compatibility with diagnostics/tests from the earlier two-provider
// implementation. Provider order is now always configuration order.
let lastServedProvider: string | null = null;
export function setActiveProvider(provider: string | null): void { lastServedProvider = provider; }
export function getActiveProvider(): string | null { return lastServedProvider; }

export interface AIProviderCandidate {
  slot: number;
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

/** True when at least one configured provider can serve requests. */
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
 * Ordered provider candidates with stable slots 1 through 4. Slots identify
 * the configured model even if an earlier provider is unavailable.
 */
export function aiProviderCandidates():AIProviderCandidate[] {
  const candidates:AIProviderCandidate[] = [];
  for (const [index, item] of providerConfigs().entries()) {
    if (!item.apiKey && !item.model) continue;
    if (!item.apiKey && !item.model && item.provider) continue;
    if (!item.apiKey && item.provider === config.ai.provider) continue;
    if (!item.apiKey || !item.model || !item.provider) throw new Error(`Configure provider ${item.provider || 'entry'} with provider, API key, and model`);
    const candidate = { slot:index + 1, name:item.provider, apiKey:item.apiKey, model:item.model, baseURL:providerBaseURL(item.provider, item.customBaseURL) };
    if (candidates.some(c => c.name === candidate.name && c.model === candidate.model)) continue;
    candidates.push(candidate);
  }
  return candidates;
}

export function aiFailureDetails(error: unknown) {
  const value = error as { status?:number; code?:unknown; body?:{code?:unknown}; name?:string; message?:string;
    request_id?:unknown; requestId?:unknown } | null;
  const status = typeof value?.status === 'number' ? value.status : undefined;
  const rawCode = value?.code || value?.body?.code;
  const code = typeof rawCode === 'string' && /^[a-z0-9_:-]{1,80}$/i.test(rawCode) ? rawCode : undefined;
  const rawRequestId = value?.request_id || value?.requestId;
  const providerRequestId = typeof rawRequestId === 'string' && /^[a-z0-9_-]{1,100}$/i.test(rawRequestId) ? rawRequestId : undefined;
  const timeout = value?.name === 'APIConnectionTimeoutError' || (value?.name === 'APIConnectionError' && /timeout/i.test(value?.message || ''));
  const reason = status === 429 ? 'RATE_LIMIT' : timeout ? 'TIMEOUT'
    : error instanceof ZodError ? 'INVALID_SCHEMA'
    : error instanceof SyntaxError ? 'INVALID_JSON'
    : /empty or truncated|no JSON object|unterminated JSON object|no usable/i.test(value?.message || '') ? 'INVALID_RESPONSE'
    : status ? 'HTTP_ERROR' : value?.name === 'APIConnectionError' ? 'NETWORK_ERROR' : 'REQUEST_ERROR';
  return { status, code, providerRequestId, reason, timeout, rateLimited: status === 429,
    errorType: typeof value?.name === 'string' ? value.name : 'UnknownError',
    validationIssueCodes: error instanceof ZodError ? error.issues.map(issue => issue.code).slice(0, 8) : undefined,
    validationIssueCount: error instanceof ZodError ? error.issues.length : undefined };
}

/**
 * Run `fn` against the configured providers in order. Falls back to the next
 * provider when the current one hits a rate limit / quota, is unreachable,
 * errors, or returns output `fn` cannot use (throw to trigger fallback).
 */
export async function withAIFallback<T>(fn:(client:OpenAI, provider:AIProviderCandidate) => Promise<T>,
  preferredProvider?: string, context: { operation?:string; aiRequestId?:string } = {}):Promise<T> {
  const all = aiProviderCandidates();
  // A caller can pin which provider serves this call, e.g. to give a fallback a
  // turn when the primary's output was technically valid but unusable.
  const candidates = preferredProvider && all.some(c=>c.name === preferredProvider)
    ? [...all].sort((a,b)=>a.name === preferredProvider ? -1 : b.name === preferredProvider ? 1 : 0)
    : all;
  if(!candidates.length) throw new Error('Set AI_API_KEY and AI_MODEL to enable AI');
  const requestStarted = Date.now();
  const attemptedSlots:number[] = [];
  let lastError:unknown;
  for(let i=0;i<candidates.length;i++) {
    const candidate = candidates[i];
    attemptedSlots.push(candidate.slot);
    const attemptStarted = Date.now();
    const details = { module:'ai', operation:context.operation || 'ai_request', aiRequestId:context.aiRequestId,
      providerSlot:candidate.slot, provider:candidate.name, model:candidate.model,
      attempt:`${i + 1}/${candidates.length}` };
    try {
      logger.info('[AI_REQUEST] provider attempt', details);
      const client = new OpenAI({apiKey:candidate.apiKey,baseURL:candidate.baseURL,timeout:config.ai.timeout,maxRetries:config.ai.retryCount});
      const result = await fn(client, candidate);
      if (candidate.name !== config.ai.provider) setActiveProvider(candidate.name);
      logger.info('[AI_SUCCESS] provider attempt', { ...details, durationMs: Date.now() - attemptStarted });
      logger.info('[AI_COMPLETE] request succeeded', { module:'ai', operation:details.operation, aiRequestId:context.aiRequestId,
        finalProviderSlot:candidate.slot, finalProvider:candidate.name, finalModel:candidate.model,
        attemptedSlots, totalDurationMs:Date.now() - requestStarted });
      return result;
    } catch(error) {
      lastError = error;
      logger.warn('[AI_FAILURE] provider attempt', { ...details, ...aiFailureDetails(error),
        durationMs: Date.now() - attemptStarted, fallbackTriggered:i < candidates.length - 1 });
      if(i < candidates.length - 1) {
        logger.warn('[AI_FALLBACK] AI provider failed; trying next provider', {
          ...details, nextProviderSlot:candidates[i + 1].slot,
          nextProvider:candidates[i + 1].name, nextModel:candidates[i + 1].model,
        });
      }
    }
  }
  logger.error('[AI_COMPLETE] all providers failed', { module:'ai', operation:context.operation || 'ai_request',
    aiRequestId:context.aiRequestId, attemptedSlots, ...aiFailureDetails(lastError), totalDurationMs:Date.now() - requestStarted });
  throw lastError;
}
