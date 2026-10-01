import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import config from '../../src/config';
import User from '../../src/modules/auth/user.model';
import ResumeProfile from '../../src/modules/resume/resume-profile.model';
import InterviewProfile from '../../src/modules/profile/interview-profile.model';
import { googleAuth } from '../../src/modules/auth/google.service';
import { createSession, hashToken } from '../../src/common/middleware/auth';
import { Session } from '../../src/modules/auth/index.model';
import { generatePersonalizedQuestions, reserveQuestion, QuestionExposure } from '../../src/modules/questions/personalized-generator';
import { AIRequest, AIUsage, structuredAI, structuredAIMeta } from '../../src/common/services/structured-ai';
import { setActiveProvider, aiProviderCandidates, getActiveProvider } from '../../src/common/services/ai-provider';
import { generatedBatchSchema } from '../../src/modules/questions/personalized-generator';
import { z } from 'zod';
import request from 'supertest';
import { app } from '../../src/index';
import MockInterview from '../../src/modules/mock-interviews/mock-interview.model';
import { Question } from '../../src/modules/questions/question.model';

const mockCreate=jest.fn();
const mockGetToken=jest.fn();
const mockVerify=jest.fn();
jest.mock('openai',()=>({__esModule:true,default:jest.fn().mockImplementation(()=>({
  chat:{completions:{create:mockCreate}},embeddings:{create:jest.fn()},
}))}));
jest.mock('google-auth-library',()=>({OAuth2Client:jest.fn().mockImplementation(()=>({
  getToken:mockGetToken,verifyIdToken:mockVerify,
}))}));
jest.setTimeout(120000);
let db:MongoMemoryServer,userId:string;
const candidate={
  question:'Imagine a React interface with overlapping network requests. How would you prevent a stale response from replacing newer state?',
  subtopic:'Request lifecycle',concepts:['React','state'],difficulty:'MEDIUM',archetype:'DEBUGGING',
  detailedAnswer:'Associate each request with a generation identifier that increments on every fetch. Apply a response only if its generation matches the latest request, because older responses must never overwrite newer state. Abort obsolete requests with an abort controller where supported, and keep loading, error and data transitions independent so a failed retry cannot blank a rendered list. In large tables, combine this with cancellation on unmount and a small cache keyed by query parameters to avoid redundant fetches.',
  estimatedAnswerTimeSeconds:180,factIds:[0],framing:'hypothetical',
};
beforeAll(async()=>{
  db=await MongoMemoryServer.create();await mongoose.connect(db.getUri());
  await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
  const user=await User.create({email:'provider@example.test',name:'Candidate',googleId:'fixture-provider',isEmailVerified:true});
  userId=String(user._id);
  const resume=await ResumeProfile.create({userId,resumeVersionId:new mongoose.Types.ObjectId(),versionNumber:1,
    skills:[{name:'React',category:'framework',isConfirmed:true,isRemoved:false}],
    projects:[{name:'Rejected secret project',description:'Do not send this to AI',isConfirmed:false}],
    parserVersion:'test',extractedAt:new Date(),userModified:true});
  await InterviewProfile.create({userId,resumeProfileId:resume._id,targetRole:'Frontend developer',
    targetLevel:'Senior',actualExperienceMonths:24,onboardingCompleted:true,confirmedSkills:['React'],
    preferences:{difficulty:'medium'}});
});
afterAll(async()=>{await mongoose.disconnect();if(db)await db.stop();});
beforeEach(()=>{config.ai.provider='openrouter';config.ai.apiKey='fixture-key-not-real';mockCreate.mockReset();setActiveProvider(null);
  config.ai.fallback={provider:'openrouter',apiKey:'',model:'',customBaseURL:''};});
test('real provider adapter validates and persists personalized questions, without unconfirmed facts',async()=>{
  mockCreate.mockResolvedValue({choices:[{message:{content:JSON.stringify({questions:[candidate]})},finish_reason:'stop'}],usage:{total_tokens:100}});
  const generated=await generatePersonalizedQuestions(userId,'React',1);
  expect(generated).toHaveLength(1);expect(generated[0].promptVersion).toBe('question-v3');
  expect(String(generated[0].ownerUserId)).toBe(userId);
  const context=JSON.parse(mockCreate.mock.calls[0][0].messages[1].content);
  expect(context.targetRole).toBe('Frontend developer');
  expect(JSON.stringify(context)).not.toContain('Rejected secret project');
  expect(await AIRequest.countDocuments({userId,status:'completed'})).toBe(1);
  const session=new mongoose.Types.ObjectId();
  const reservations=await Promise.all([reserveQuestion(userId,session,generated[0]),reserveQuestion(userId,session,generated[0])]);
  expect(reservations.filter(Boolean)).toHaveLength(1);
});
test('same generated text is rejected after assignment and never padded with templates',async()=>{
  mockCreate.mockResolvedValue({choices:[{message:{content:JSON.stringify({questions:[candidate]})},finish_reason:'stop'}]});
  // Every fresh candidate is a duplicate of the reserved one, so generation
  // reports unavailability instead of padding the session with repeats.
  await expect(generatePersonalizedQuestions(userId,'React',1)).rejects.toThrow('Question generation unavailable');
  expect(await QuestionExposure.countDocuments({userId})).toBe(1);
});
test('malformed AI output records failure and is not shown to the user',async()=>{
  mockCreate.mockResolvedValue({choices:[{message:{content:'not JSON'},finish_reason:'stop'}]});
  await expect(generatePersonalizedQuestions(userId,'Security',1)).rejects.toThrow('Question generation unavailable');
  expect(await AIRequest.countDocuments({userId,status:'failed'})).toBeGreaterThan(0);
});
test('per-user AI budget is enforced atomically',async()=>{
  const previous=config.ai.dailyRequestLimit;config.ai.dailyRequestLimit=1;
  const budgetUser='budget-user';
  mockCreate.mockResolvedValue({choices:[{message:{content:'{"value":1}'},finish_reason:'stop'}]});
  const input={userId:budgetUser,purpose:'test',version:'test',system:'Return JSON',context:{},schema:z.object({value:z.number()})};
  const results=await Promise.allSettled([structuredAI(input),structuredAI(input)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await AIUsage.findOne({userId:budgetUser}))!.requests).toBe(1);
  config.ai.dailyRequestLimit=previous;
});
test('primary provider failure falls back to the second provider and records it',async()=>{
  config.ai.fallback={provider:'gemini',apiKey:'fallback-fixture-key',model:'gemini-fallback-model',customBaseURL:''};
  // First call (primary) fails; second call (fallback) returns valid output.
  mockCreate.mockRejectedValueOnce(new Error('429 free-models-per-day limit reached'))
    .mockResolvedValueOnce({choices:[{message:{content:JSON.stringify({questions:[candidate]})},finish_reason:'stop'}],usage:{total_tokens:100}});
  const meta=await structuredAIMeta({userId,purpose:'personalized-questions',version:'question-v3',
    system:'Return JSON',context:{},schema:generatedBatchSchema});
  expect(meta.provider).toBe('gemini');
  expect(meta.fallbackUsed).toBe(true);
  const log=await AIRequest.findOne({userId,purpose:'personalized-questions',status:'completed'}).sort({createdAt:-1});
  expect(log!.provider).toBe('gemini');expect(log!.model).toBe('gemini-fallback-model');
  // The fallback stays first until the process restarts or the primary succeeds again.
  expect(aiProviderCandidates().map(c=>c.name)).toEqual(['gemini','openrouter']);
});

test('question generation uses the fallback provider and tags generatorModel with it',async()=>{
  config.ai.fallback={provider:'gemini',apiKey:'fallback-fixture-key',model:'gemini-fallback-model',customBaseURL:''};
  // A security question distinct from the reserved React question so the
  // duplicate filters pass and the fallback's output is actually used.
  const securityCandidate={
    question:'A suspicious privilege escalation alert fires in production at 3am. Walk through your security incident response from triage to postmortem.',
    subtopic:'Incident response',concepts:['Security','incident response'],difficulty:'MEDIUM',archetype:'PRODUCTION_SCENARIO',
    detailedAnswer:'Begin by containing the affected host so the potential attacker loses access, then capture volatile evidence such as active sessions and process lists before restarting anything. Review authentication logs to identify how credentials were obtained, rotate every exposed secret, and patch the escalation path. During the postmortem, record the security timeline, the detection gap that allowed the alert to fire late, and the monitoring or least-privilege changes that prevent a repeat incident.',
    estimatedAnswerTimeSeconds:180,factIds:[0],framing:'hypothetical',
  };
  const completedBefore=await AIRequest.countDocuments({userId,status:'completed',provider:'gemini'});
  mockCreate.mockRejectedValueOnce(new Error('ECONNREFUSED primary unreachable'))
    .mockResolvedValueOnce({choices:[{message:{content:JSON.stringify({questions:[securityCandidate]})},finish_reason:'stop'}],usage:{total_tokens:100}});
  const generated=await generatePersonalizedQuestions(userId,'Security',1);
  expect(generated).toHaveLength(1);
  expect(generated[0].generatorModel).toBe('gemini-fallback-model');
  expect(await AIRequest.countDocuments({userId,status:'completed',provider:'gemini'})).toBe(completedBefore+1);
});

test('mocked Google login verifies state and nonce, creates an account, and rejects replay',async()=>{
  config.google.clientId='fixture-client';config.google.clientSecret='fixture-secret';
  const flow=await googleAuth.begin();
  const saved=await mongoose.model('OAuthState').findOne();
  mockGetToken.mockResolvedValue({tokens:{id_token:'fixture-id-token'}});
  mockVerify.mockResolvedValue({getPayload:()=>({sub:'google-fixture-sub',email:'google@example.test',email_verified:true,
    name:'Google Candidate',nonce:saved.nonce})});
  await expect(googleAuth.callback('code',flow.state,'wrong-cookie','test')).rejects.toThrow('Invalid OAuth state');
  const result=await googleAuth.callback('code',flow.state,flow.state,'test');
  expect(result.sessionToken).toBeTruthy();
  expect(await Session.exists({token:hashToken(result.sessionToken)})).toBeTruthy();
  expect(await Session.exists({token:result.sessionToken})).toBeNull();
  expect(await User.countDocuments({email:'google@example.test'})).toBe(1);
  await expect(googleAuth.callback('code',flow.state,flow.state,'test')).rejects.toThrow('expired or already used');
});

test('mock interviewer uses the answer for a new follow-up and rejects replayed turns',async()=>{
  const agent=request.agent(app);
  agent.set('Cookie',config.auth.cookieName+'='+await createSession(userId));
  const question=await Question.create({question:'How would you diagnose slow React renders in a large table with frequent state updates?',
    topic:'React',subtopic:'Profiling',concepts:['React'],difficulty:'MEDIUM',questionType:'CONCEPTUAL',archetype:'DEBUGGING',
    provenance:'CURATED',qualityStatus:'approved'});
  const interview=await MockInterview.create({userId,type:'technical',title:'React',status:'in_progress',totalQuestions:1,
    questions:[{questionId:question._id,questionSnapshot:question.toObject(),order:0,status:'asked'}]});
  mockCreate.mockResolvedValueOnce({choices:[{message:{content:'{}'},finish_reason:'stop'}]})
    .mockResolvedValueOnce({choices:[{message:{content:JSON.stringify({question:'Your profiling identifies excessive renders caused by changing callback identity. How would you fix this without introducing stale closures?',concepts:['React','closures']})},finish_reason:'stop'}]});
  const response=await agent.post('/api/mock-interviews/'+interview._id+'/answer').send({turn:0,answer:'I would use the React profiler to measure render cost and identify unstable props before optimizing.'});
  expect(response.status).toBe(200);expect(response.body.data.questions).toHaveLength(2);
  expect(response.body.data.questions[1].isFollowUp).toBe(true);
  expect(mockCreate.mock.calls[1][0].messages[1].content).toContain('unstable props');
  expect((await agent.post('/api/mock-interviews/'+interview._id+'/answer').send({turn:0,answer:'A repeated answer must not create another turn.'})).status).toBe(409);
});
