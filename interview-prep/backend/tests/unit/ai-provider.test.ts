import OpenAI from 'openai';
import config from '../../src/config';
import { aiBaseURL, createAIClient, hasAI, hasAnyAI, hasFallbackAI, aiProviderCandidates, withAIFallback, setActiveProvider, getActiveProvider } from '../../src/common/services/ai-provider';
import { extractJsonObject } from '../../src/common/services/structured-ai';
import logger from '../../src/config/logger';
jest.mock('openai',()=>({__esModule:true,default:jest.fn().mockImplementation(()=>({}))}));
beforeEach(()=>{
  config.ai.provider='openrouter';config.ai.apiKey='fixture-key';config.ai.model='fixture-model';config.ai.customBaseURL='';
  config.ai.fallback.provider='openrouter';config.ai.fallback.apiKey='';config.ai.fallback.model='';config.ai.fallback.customBaseURL='';
  config.ai.fallback2.provider='';config.ai.fallback2.apiKey='';config.ai.fallback2.model='';config.ai.fallback2.customBaseURL='';
  config.ai.fallback3.provider='';config.ai.fallback3.apiKey='';config.ai.fallback3.model='';config.ai.fallback3.customBaseURL='';
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
  test('a complete fallback alone is enough to generate questions',()=>{
    config.ai.apiKey='';config.ai.model='';
    config.ai.fallback.provider='gemini';config.ai.fallback.apiKey='fallback-key';config.ai.fallback.model='fallback-model';
    expect(hasAI()).toBe(false);
    expect(hasAnyAI()).toBe(true);
    expect(aiProviderCandidates().map(c=>c.name)).toEqual(['gemini']);
  });
  test('fallback provider is tried first once it has taken over (sticky)',()=>{
    config.ai.fallback.provider='gemini';config.ai.fallback.apiKey='fallback-key';config.ai.fallback.model='fallback-model';
    setActiveProvider('gemini');
    expect(getActiveProvider()).toBe('gemini');
    expect(aiProviderCandidates().map(c=>c.name)).toEqual(['openrouter','gemini']);
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
    // Strict order is retained for every request; fallback success is diagnostic only.
    expect(aiProviderCandidates().map(c=>c.name)).toEqual(['openrouter','gemini']);
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

describe('four-provider Render diagnostics',()=>{
  beforeEach(()=>{
    config.ai.fallback={provider:'custom',apiKey:'fixture-2',model:'model-2',customBaseURL:'https://nvidia.example/v1'};
    config.ai.fallback2={provider:'openrouter',apiKey:'fixture-3',model:'model-3',customBaseURL:''};
    config.ai.fallback3={provider:'tokenrouter',apiKey:'fixture-4',model:'model-4',customBaseURL:''};
  });

  test.each([1,2,3,4])('success at provider slot %i logs every preceding failure and final model',async (successSlot)=>{
    const info=jest.spyOn(logger,'info').mockImplementation(()=>logger);
    const warn=jest.spyOn(logger,'warn').mockImplementation(()=>logger);
    try {
      const result=await withAIFallback(async (_client,candidate)=>{
        if(candidate.slot!==successSlot) {
          const error=Object.assign(new Error('sensitive prompt must not appear'),{status:429,code:'rate_limit'});
          throw error;
        }
        return candidate.model;
      },undefined,{operation:'question_generation',aiRequestId:'ai-test-123'});
      expect(result).toBe(successSlot===1?'fixture-model':`model-${successSlot}`);
      const requests=(info.mock.calls as unknown as Array<[string, any]>).filter(([message])=>message==='[AI_REQUEST] provider attempt');
      const failures=(warn.mock.calls as unknown as Array<[string, any]>).filter(([message])=>message==='[AI_FAILURE] provider attempt');
      expect(requests.map(([,meta])=>(meta as any).providerSlot)).toEqual(Array.from({length:successSlot},(_,i)=>i+1));
      expect(failures.map(([,meta])=>(meta as any).providerSlot)).toEqual(Array.from({length:successSlot-1},(_,i)=>i+1));
      expect(failures.every(([,meta])=>(meta as any).reason==='RATE_LIMIT')).toBe(true);
      expect(JSON.stringify(failures)).not.toContain('sensitive prompt');
      expect(info).toHaveBeenCalledWith('[AI_COMPLETE] request succeeded',expect.objectContaining({
        operation:'question_generation',aiRequestId:'ai-test-123',finalProviderSlot:successSlot,finalModel:result,
      }));
    } finally { info.mockRestore();warn.mockRestore(); }
  });

  test('all four failures are logged with configured slots and no success',async()=>{
    const warn=jest.spyOn(logger,'warn').mockImplementation(()=>logger);
    const error=jest.spyOn(logger,'error').mockImplementation(()=>logger);
    try {
      await expect(withAIFallback(async()=>{throw new SyntaxError('resume text must stay private');},
        undefined,{operation:'question_generation',aiRequestId:'ai-test-all'})).rejects.toThrow();
      const failures=(warn.mock.calls as unknown as Array<[string, any]>).filter(([message])=>message==='[AI_FAILURE] provider attempt');
      expect(failures.map(([,meta])=>(meta as any).providerSlot)).toEqual([1,2,3,4]);
      expect(failures.every(([,meta])=>(meta as any).reason==='INVALID_JSON')).toBe(true);
      expect(error).toHaveBeenCalledWith('[AI_COMPLETE] all providers failed',expect.objectContaining({
        operation:'question_generation',aiRequestId:'ai-test-all',attemptedSlots:[1,2,3,4],reason:'INVALID_JSON',
      }));
      expect(JSON.stringify(failures)).not.toContain('resume text');
    } finally { warn.mockRestore();error.mockRestore(); }
  });
});
