import OpenAI from 'openai';
import config from '../../src/config';
import { aiBaseURL, createAIClient, hasAI } from '../../src/common/services/ai-provider';
jest.mock('openai',()=>({__esModule:true,default:jest.fn().mockImplementation(()=>({}))}));
beforeEach(()=>{config.ai.provider='openrouter';config.ai.apiKey='fixture-key';config.ai.model='fixture-model';config.ai.customBaseURL='';});
test.each([
  ['openrouter','https://openrouter.ai/api/v1'],
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
