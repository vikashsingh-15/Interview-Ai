/**
 * Live smoke test: exercises the topic practice HTTP surface end to end,
 * including the on-demand AI generation path that the offline suite cannot
 * reach. Skips itself when no AI provider is configured so it never fails on a
 * machine without credentials.
 *
 * Run it with `npx jest -c jest.live.config.js --no-coverage --forceExit`;
 * the default jest.config.js blanks AI credentials (tests/setup.ts), so there
 * this file always skips.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import config from '../../src/config';
import { app } from '../../src/index';
import { Question } from '../../src/modules/questions/question.model';
import { createSession } from '../../src/common/middleware/auth';
import User from '../../src/modules/auth/user.model';
import ResumeProfile from '../../src/modules/resume/resume-profile.model';

jest.setTimeout(180000);
let db: MongoMemoryServer;
const agent = request.agent(app);
let userId: string;

const hasAI = Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);
const maybe = hasAI ? test : test.skip;

beforeAll(async () => {
  if (!hasAI) return; // Skipped run: don't pay for a Mongo boot.
  db = await MongoMemoryServer.create();
  process.env.MONGODB_URI = db.getUri();
  await mongoose.connect(db.getUri());
  const user = await User.create({
    email: 'topic-live@example.test', name: 'Topic Live', googleId: 'fixture-topic-live',
    isEmailVerified: true,
  });
  userId = String(user._id);
  agent.set('Cookie', config.auth.cookieName + '=' + (await createSession(userId)));
});

afterAll(async () => {
  if (!db) return;
  await mongoose.disconnect();
  await db.stop();
});

maybe('a thin topic generates strictly on-topic questions with the configured AI provider', async () => {
  // Seed exactly one AWS question so the requested count of 3 cannot be met.
  await Question.create({
    question: 'How does AWS Lambda handle cold starts for a JVM function?',
    topic: 'AWS', subtopic: 'Lambda', concepts: ['lambda', 'cold start'],
    difficulty: 'HARD', questionType: 'INTERNAL_WORKING', archetype: 'INTERNAL_WORKING',
    interviewPriority: 'HIGH', resumeRelevance: 'LOW', expectedAnswerDepth: 'DEEP',
    estimatedAnswerTimeSeconds: 180, provenance: 'CURATED', qualityStatus: 'approved',
    detailedAnswer: 'Lambda keeps an execution environment warm between invocations; a JVM function pays class loading and JIT warm-up on a cold start.',
  });

  const res = await agent.post('/api/topics/practice')
    .send({ topic: 'AWS', difficulties: ['HARD'], count: 3 });

  expect(res.status).toBe(200);
  const questions = res.body.data.questions;
  expect(questions.length).toBeGreaterThan(0);
  expect(res.body.data.generated).toBeGreaterThan(0);
  // Every generated question must be about AWS, not a generic interview prompt.
  const AWS_TERMS = ['aws', 'amazon', 'lambda', 's3', 'ec2', 'dynamodb', 'cloudwatch', 'sqs', 'iam'];
  for (const q of questions) {
    expect(q.topic).toBe('AWS');
    expect(q.difficulty).toBe('HARD');
    expect(AWS_TERMS.some((term) => q.question.toLowerCase().includes(term))).toBe(true);
  }

  // The generated questions are answerable through the normal answer route.
  const answer = await agent.get(`/api/topics/questions/${questions[0].id}/answer`);
  expect(answer.status).toBe(200);
  expect(answer.body.data.sections?.direct || answer.body.data.legacyAnswer).toBeTruthy();
});

maybe('confirmed experience generates grounded questions and structured answers with the live provider', async () => {
  const claim = 'Developed Spring Boot services integrating CyberArk REST APIs';
  const profile = await ResumeProfile.create({ userId, resumeVersionId: new mongoose.Types.ObjectId(),
    versionNumber: 1, parserVersion: 'live-test-fixture', experience: [{ company: 'Fixture employer', role: 'Engineer',
      isConfirmed: true, technologies: ['Java', 'Spring Boot', 'CyberArk'], responsibilities: [claim], technicalClaims: [claim] }] });
  const source = { kind: 'experience', id: String(profile.experience[0]._id) };
  const result = await agent.post('/api/topics/practice').send({ topic: 'ignored client label', source,
    count: 1, difficulties: ['HARD'], questionTypes: ['resume_deep_dive'] });
  expect(result.status).toBe(200);
  expect(result.body.data.generated).toBe(1);
  const question = result.body.data.questions[0];
  const saved = await Question.findById(question.id);
  expect(saved?.practiceSource?.id).toBe(source.id);
  expect(saved?.sourceEvidence?.length).toBeGreaterThan(0);
  expect(saved?.sourceEvidence?.some(fact => question.question.includes(fact))).toBe(true);
  const answer = await agent.get(`/api/topics/questions/${question.id}/answer`);
  expect(answer.status).toBe(200);
  expect(answer.body.data.sections?.direct || answer.body.data.legacyAnswer).toBeTruthy();
});
