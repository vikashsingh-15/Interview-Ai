import OpenAI from 'openai';
import config from '../../src/config';
import { aiBaseURL, createAIClient, hasAI, hasFallbackAI, aiProviderCandidates, withAIFallback, setActiveProvider, getActiveProvider } from '../../src/common/services/ai-provider';
import { extractJsonObject } from '../../src/common/services/structured-ai';
jest.mock('openai',()=>({__esModule:true,default:jest.fn().mockImplementation(()=>({}))}));
beforeEach(()=>{
  config.ai.provider='openrouter';config.ai.apiKey='fixture-key';config.ai.model='fixture-model';config.ai.customBaseURL='';
  config.ai.fallback.provider='openrouter';config.ai.fallback.apiKey='';config.ai.fallback.model='';config.ai.fallback.customBaseURL='';
  setActiveProvider(null);
});
test.each([
  ['openrouter','https://openrouter.ai/api/v1'],
  ['tokenrouter','https://api.tokenrouter.com/v1'],
  ['gemini','https://generativelanguage.googleapis.com/v1beta/openai/'],
  ['openai','https://api.openai.com/v1'],
])('%s selects the correct endpoint', (provider,url)=>{
  config.ai.provider=provider;createAIClient();
  expect(OpenAI).toHaveBeenLastCalledWith(expect.objectContaining({apiKey:'fixture-key',baseURL:url}));
});
test('custom endpoint is supported without a separate provider key',()=>{
  config.ai.provider='custom';config.ai.customBaseURL='https://compatible.example/v1';
  expect(aiBaseURL()).toBe('https://compatible.example/v1');
});
test('unsafe custom endpoints and unknown providers are rejected',()=>{
  config.ai.provider='custom';config.ai.customBaseURL='http://untrusted.example/v1';
  expect(aiBaseURL).toThrow('HTTPS');
  config.ai.customBaseURL='https://user:secret@untrusted.example';expect(aiBaseURL).toThrow('credentials');
  config.ai.provider='unknown';expect(aiBaseURL).toThrow('AI_PROVIDER');
});
test('both a key and a model are required for AI',()=>{
  config.ai.apiKey='';expect(hasAI()).toBe(false);expect(createAIClient).toThrow('AI_API_KEY');
  config.ai.apiKey='fixture';config.ai.model='';expect(hasAI()).toBe(false);
});
test('JWT, email and configurable cookie flags are absent',()=>{
  expect(config).not.toHaveProperty('email');expect(config).not.toHaveProperty('features');
  expect(config.auth).not.toHaveProperty('jwtSecret');
  expect(config.auth.cookieSameSite).toBe('lax');expect(config.auth.sessionDurationMs).toBe(7*86400000);
});

describe('fallback provider',()=>{
  test('without fallback env vars only the primary candidate exists',()=>{
    expect(hasFallbackAI()).toBe(false);
    expect(aiProviderCandidates()).toHaveLength(1);
    expect(aiProviderCandidates()[0].name).toBe('openrouter');
  });
  test('a copy of the primary provider does not count as a fallback',()=>{
    config.ai.fallback.provider='openrouter';config.ai.fallback.apiKey='fixture-key';config.ai.fallback.model='fixture-model';
    expect(hasFallbackAI()).toBe(false);
    expect(aiProviderCandidates()).toHaveLength(1);
  });
  test('configured fallback is listed after the primary with its own endpoint',()=>{
    config.ai.fallback.provider='gemini';config.ai.fallback.apiKey='fallback-key';config.ai.fallback.model='fallback-model';
    expect(hasFallbackAI()).toBe(true);
    const candidates=aiProviderCandidates();
    expect(candidates.map(c=>c.name)).toEqual(['openrouter','gemini']);
    expect(candidates[1]).toEqual(expect.objectContaining({
      apiKey:'fallback-key',model:'fallback-model',
      baseURL:'https://generativelanguage.googleapis.com/v1beta/openai/'}));
  });
  test('fallback provider is tried first once it has taken over (sticky)',()=>{
    config.ai.fallback.provider='gemini';config.ai.fallback.apiKey='fallback-key';config.ai.fallback.model='fallback-model';
    setActiveProvider('gemini');
    expect(getActiveProvider()).toBe('gemini');
    expect(aiProviderCandidates().map(c=>c.name)).toEqual(['gemini','openrouter']);
  });
  test('withAIFallback uses the primary when it succeeds',async()=>{
    config.ai.fallback.provider='gemini';config.ai.fallback.apiKey='fallback-key';config.ai.fallback.model='fallback-model';
    const result=await withAIFallback(async(client,candidate)=>({served:candidate.name}));
    expect(result.served).toBe('openrouter');
    expect(getActiveProvider()).toBeNull();
  });
  test('withAIFallback switches to the fallback on primary failure and sticks',async()=>{
    config.ai.fallback.provider='gemini';config.ai.fallback.apiKey='fallback-key';config.ai.fallback.model='fallback-model';
    const result=await withAIFallback(async(_client,candidate)=>{
      if(candidate.name!=='gemini') throw new Error('429 quota reached');
      return {served:candidate.name};
    });
    expect(result.served).toBe('gemini');
    expect(getActiveProvider()).toBe('gemini');
    // Sticky: next call attempts the fallback first.
    expect(aiProviderCandidates().map(c=>c.name)).toEqual(['gemini','openrouter']);
  });
  test('withAIFallback throws the primary error when every provider fails',async()=>{
    config.ai.fallback.provider='gemini';config.ai.fallback.apiKey='fallback-key';config.ai.fallback.model='fallback-model';
    await expect(withAIFallback(async()=>{throw new Error('all providers down');})).rejects.toThrow('all providers down');
    expect(getActiveProvider()).toBeNull();
  });
  test('withAIFallback without AI configured explains what to set',async()=>{
    config.ai.apiKey='';config.ai.model='';
    await expect(withAIFallback(async()=>({}))).rejects.toThrow('AI_API_KEY');
  });
  test('createAIClient can build the fallback client explicitly',()=>{
    config.ai.fallback.provider='gemini';config.ai.fallback.apiKey='fallback-key';config.ai.fallback.model='fallback-model';
    createAIClient('gemini');
    expect(OpenAI).toHaveBeenLastCalledWith(expect.objectContaining({apiKey:'fallback-key',baseURL:'https://generativelanguage.googleapis.com/v1beta/openai/'}));
    config.ai.fallback.apiKey='';config.ai.fallback.model='';
    expect(()=>createAIClient('gemini')).toThrow('AI_FALLBACK');
  });
  test('custom fallback endpoint is validated like the primary',()=>{
    config.ai.provider='openrouter';
    config.ai.fallback.provider='custom';config.ai.fallback.apiKey='fallback-key';config.ai.fallback.model='fallback-model';
    config.ai.fallback.customBaseURL='http://untrusted.example/v1';
    expect(()=>aiProviderCandidates()).toThrow('HTTPS');
  });
  test('a caller can pin which provider serves the call',async()=>{
    config.ai.provider='openrouter';config.ai.apiKey='primary-key';config.ai.model='primary-model';
    config.ai.fallback={provider:'gemini',apiKey:'fallback-key',model:'fallback-model',customBaseURL:''};
    await expect(withAIFallback(async()=>'served-by-pinned-provider', 'gemini')).resolves.toBe('served-by-pinned-provider');
    expect(OpenAI).toHaveBeenLastCalledWith(expect.objectContaining({apiKey:'fallback-key'}));
  });
});

describe('structured AI response parsing',()=>{
  test('a bare JSON object is parsed',()=>{
    expect(extractJsonObject('{"questions":[]}')).toEqual({questions:[]});
  });
  test('fenced JSON and trailing prose still parse',()=>{
    // Providers routinely wrap the payload or add a remark after it; a bare
    // JSON.parse would fail even though the object is intact.
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({a:1});
    expect(extractJsonObject('{"a":1}\n\nHope this helps!')).toEqual({a:1});
    expect(extractJsonObject('Here you go:\n{"a":1}')).toEqual({a:1});
  });
  test('braces inside strings do not end the object early',()=>{
    expect(extractJsonObject('{"question":"Explain {braces} in JSON","difficulty":"EASY"} trailing'))
      .toEqual({question:'Explain {braces} in JSON',difficulty:'EASY'});
    expect(extractJsonObject('{"question":"a \\"quoted\\" brace }","difficulty":"HARD"}'))
      .toEqual({question:'a "quoted" brace }',difficulty:'HARD'});
  });
  test('responses without a complete object are rejected',()=>{
    expect(()=>extractJsonObject('no json here')).toThrow('no JSON object');
    expect(()=>extractJsonObject('{"a":1')).toThrow('unterminated');
  });
});
