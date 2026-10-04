import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import config from '../../src/config';
import { app } from '../../src/index';
import User from '../../src/modules/auth/user.model';
import ResumeProfile from '../../src/modules/resume/resume-profile.model';
import Project from '../../src/modules/projects/project.model';
import { Question } from '../../src/modules/questions/question.model';
import { QuestionHistory } from '../../src/modules/questions/question-history.model';
import { createSession } from '../../src/common/middleware/auth';
import { syncProjectsFromResume } from '../../src/modules/projects/sync-from-resume';
import * as structured from '../../src/common/services/structured-ai';
import * as ai from '../../src/common/services/ai-provider';

jest.setTimeout(120000);
let db: MongoMemoryServer;
let owner: string;
let profile: any;
let project: any;
const agent = request.agent(app);
const other = request.agent(app);
const claim = 'Developed Spring Boot services integrating 8 CyberArk REST endpoints';
const answer = 'A reference guide should ask the candidate to explain the actual endpoints, authentication flow and error handling. Start with the stored claim, distinguish the responsibilities they owned from those shared by their team, and ask for implementation evidence. Describe trade-offs and failure handling as hypothetical design considerations rather than pretending the candidate implemented details that are absent from their resume.';
let generate: jest.SpyInstance;

beforeAll(async () => {
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  const user = await User.create({ email: 'source@example.test', name: 'Source tester', googleId: 'source-owner', isEmailVerified: true });
  owner = String(user._id);
  agent.set('Cookie', `${config.auth.cookieName}=${await createSession(owner)}`);
  const stranger = await User.create({ email: 'stranger@example.test', name: 'Stranger', googleId: 'source-stranger', isEmailVerified: true });
  other.set('Cookie', `${config.auth.cookieName}=${await createSession(String(stranger._id))}`);
  profile = await ResumeProfile.create({ userId: owner, resumeVersionId: new mongoose.Types.ObjectId(),
    versionNumber: 1, parserVersion: 'fixture', experience: [{ company: 'TCS', role: 'Engineer',
      isConfirmed: true, responsibilities: [claim], technologies: ['Java', 'Spring Boot', 'CyberArk'],
      achievements: ['Automated account reconciliation'], technicalClaims: [claim] }] });
  project = await Project.create({ userId: owner, name: 'Cortex', slug: `cortex-${owner}`, role: 'Developer',
    description: 'Implemented document retrieval using Pinecone and LangGraph', technologies: ['Pinecone', 'LangGraph'],
    architectureDescription: 'Document chunking and vector retrieval with grounded answers',
    myContribution: 'Designed the document ingestion pipeline', securityClaims: ['Owner-only document retrieval'] });
  jest.spyOn(ai, 'hasAI').mockReturnValue(true);
  generate = jest.spyOn(structured, 'structuredAIMeta').mockImplementation(async (input: any) => {
    const evidence = input.context.source.responsibilities?.[0] || input.context.source.description;
    return { result: { questions: [{ question: `You stated "${evidence}". Explain your contribution, implementation decisions and how you verified this work.`,
      subtopic: 'Resume verification', concepts: ['implementation'], difficulty: 'HARD', archetype: 'DEEP_DIVE',
      evidence: [evidence], detailedAnswer: answer, estimatedAnswerTimeSeconds: 180 }] },
    provider: 'fixture', model: 'fixture', fallbackUsed: false } as any;
  });
});
afterAll(async () => { jest.restoreAllMocks(); await mongoose.disconnect(); await db.stop(); });

test('experience reuses stored context, settings, answers, history and calendar', async () => {
  const source = { kind: 'experience', id: String(profile.experience[0]._id) };
  const list = await agent.get('/api/topics/experience');
  expect(list.body.data[0].responsibilities).toContain(claim);
  const start = await agent.post('/api/topics/practice').send({ topic: 'ignored browser label', source,
    difficulties: ['HARD'], questionTypes: ['resume_deep_dive'], count: 1 });
  expect(start.status).toBe(200);
  const q = start.body.data.questions[0];
  expect(q.question).toContain(claim);
  const call = generate.mock.calls.at(-1)![0];
  expect(call.context.source.company).toBe('TCS');
  expect(call.context.source.technicalClaims).toEqual([claim]);
  expect(call.system).toContain('Do not invent');
  expect(call.context.difficulties).toContain('HARD');
  const saved = await Question.findById(q.id);
  expect(saved!.practiceSource?.id).toBe(source.id);
  expect(saved!.sourceEvidence).toEqual([claim]);
  const day = await agent.get('/api/calendar/today');
  expect(day.body.data.entries.find((e: any) => e.metadata?.questionId === q.id).metadata.practiceSource.id).toBe(source.id);
  expect((await agent.get(`/api/topics/source/experience/${source.id}`)).body.data.questions).toHaveLength(1);
  const history = await agent.get('/api/topics/history').query({ sourceKind: source.kind, sourceId: source.id });
  expect(history.body.data).toHaveLength(1);
  const hasAI = jest.spyOn(ai, 'hasAI').mockReturnValue(false);
  expect((await agent.get(`/api/topics/questions/${q.id}/answer`)).body.data.legacyAnswer).toBe(answer);
  hasAI.mockReturnValue(true);
  expect((await agent.post(`/api/topics/questions/${q.id}/skip`)).status).toBe(200);
  expect((await QuestionHistory.findOne({ userId: owner, questionId: q.id }))!.status).toBe('SKIPPED');
});

test('project practice is scoped to the project and never leaks to another user', async () => {
  const source = { kind: 'project', id: String(project._id) };
  expect((await other.get(`/api/topics/source/project/${source.id}`)).status).toBe(404);
  expect((await other.post('/api/topics/practice').send({ topic: 'Cortex', source, count: 1 })).status).toBe(404);
  const result = await agent.post('/api/topics/practice').send({ topic: 'Cortex', source, count: 1, difficulties: ['HARD'] });
  expect(result.status).toBe(200);
  expect(result.body.data.questions).toHaveLength(1);
  expect(generate.mock.calls.at(-1)![0].context.source.architecture).toContain('chunking');
  const q = result.body.data.questions[0];
  expect(q.isProjectInterview).toBe(true);
  expect((await other.get(`/api/topics/questions/${q.id}/answer`)).status).toBe(404);
  expect((await agent.get('/api/topics/history').query({ sourceKind: 'project', sourceId: source.id })).body.data).toHaveLength(1);
  expect((await agent.get('/api/calendar/today')).body.data.entries.find((e: any) => e.metadata?.questionId === q.id).type).toBe('project');
});

test('malformed, removed and unconfirmed sources are rejected; unsupported claims are never persisted', async () => {
  expect((await agent.post('/api/topics/practice').send({ topic: 'x', source: { kind: 'experience', id: 'bad' } })).status).toBe(400);
  const id = String(profile.experience[0]._id);
  expect((await other.get(`/api/topics/source/experience/${id}`)).status).toBe(404);
  await ResumeProfile.updateOne({ _id: profile._id }, { 'experience.0.isConfirmed': false });
  expect((await agent.get(`/api/topics/source/experience/${id}`)).status).toBe(400);
  await ResumeProfile.updateOne({ _id: profile._id }, { 'experience.0.isConfirmed': true, 'experience.0.isRemoved': true });
  expect((await agent.get(`/api/topics/source/experience/${id}`)).status).toBe(404);
  await ResumeProfile.updateOne({ _id: profile._id }, { 'experience.0.isRemoved': false });
  generate.mockImplementationOnce(async () => ({ result: { questions: [{ question: 'Describe your Kubernetes production platform that served millions of users.',
    evidence: ['Built a Kubernetes platform'], detailedAnswer: answer, difficulty: 'HARD',
    subtopic: 'Fake claim', concepts: ['Kubernetes'], archetype: 'DEEP_DIVE', estimatedAnswerTimeSeconds: 180 }] } }));
  const before = await Question.countDocuments();
  const result = await agent.post('/api/topics/practice').send({ topic: 'x', source: { kind: 'experience', id },
    difficulties: ['HARD'], count: 1, excludeQuestionIds: (await Question.find({ 'practiceSource.id': id }).select('_id')).map(q => String(q._id)) });
  expect(result.body.data.questions).toHaveLength(0);
  expect(result.body.data.message).toContain('unsupported_source_claim');
  expect(await Question.countDocuments()).toBe(before);
});

test('same-named sources remain separate and no-AI returns an honest message', async () => {
  const p = await Project.create({ userId: owner, name: 'Cortex', slug: `cortex-second-${owner}`, role: 'Developer', description: 'A separate project with the same name' });
  const source = { kind: 'project', id: String(p._id) };
  expect((await agent.get(`/api/topics/source/project/${source.id}`)).body.data.questions).toHaveLength(0);
  jest.spyOn(ai, 'hasAI').mockReturnValue(false);
  const result = await agent.post('/api/topics/practice').send({ topic: 'Cortex', source, count: 5 });
  expect(result.status).toBe(200);
  expect(result.body.data.questions).toHaveLength(0);
  expect(result.body.data.message).toContain('AI provider');
  jest.spyOn(ai, 'hasAI').mockReturnValue(true);
});

test('removing every confirmed resume project hides synced entries without deleting history', async () => {
  const p = await Project.create({ userId: owner, name: 'Old resume project', slug: `old-${owner}`, role: 'Developer', description: 'Historical project', isVerifiedFromResume: true });
  expect(await syncProjectsFromResume(owner, { projects: [] })).toBe(0);
  expect((await Project.findById(p._id))!.isHidden).toBe(true);
  expect(await QuestionHistory.countDocuments({ userId: owner })).toBeGreaterThan(0);
});
