import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import config from '../../src/config';
import { app } from '../../src/index';
import { docxResume } from '../helpers/resume-fixtures';
import { Question } from '../../src/modules/questions/question.model';
import { createSession } from '../../src/common/middleware/auth';
import User from '../../src/modules/auth/user.model';

jest.setTimeout(120000);
let db: MongoMemoryServer;
const agent = request.agent(app);
let userId: string;
const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

beforeAll(async () => {
  db = await MongoMemoryServer.create();
  process.env.MONGODB_URI = db.getUri();
  await mongoose.connect(db.getUri());
  const user = await User.create({
    email: 'topics-test@example.test', name: 'Topics Tester',
    googleId: 'fixture-topics', isEmailVerified: true,
  });
  userId = String(user._id);
  agent.set('Cookie', config.auth.cookieName + '=' + (await createSession(userId)));
});

afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});

test('topic practice: list, practice set, skip, feedback, history, calendar sync and answers', async () => {
  // Seed a couple of approved curated questions in the SQL topic.
  await Question.create([
    {
      question: 'How does a B-tree index make range queries fast in SQL databases?',
      topic: 'SQL', subtopic: 'Indexing', concepts: ['btree', 'index'],
      difficulty: 'MEDIUM', questionType: 'CONCEPTUAL', archetype: 'CONCEPTUAL',
      interviewPriority: 'HIGH', resumeRelevance: 'LOW', expectedAnswerDepth: 'MODERATE',
      estimatedAnswerTimeSeconds: 120, provenance: 'CURATED', qualityStatus: 'approved',
      detailedAnswer: 'A B-tree keeps keys sorted with logarithmic depth so range scans read a contiguous set of leaf pages, making ORDER BY and range predicates efficient.',
      interviewAnswerSections: { direct: 'It keeps keys sorted for logarithmic lookups and ordered leaf scans.', questionFocus: 'B-tree index internals for ranges', why: 'Sorted structure allows seeking the first matching key then scanning.', how: 'Descent compares keys per node; leaves link in order for scans.', example: 'A WHERE created_at BETWEEN d1 AND d2 clause seeks once and scans.', tradeOff: 'Writes pay extra to maintain order versus a heap scan.', summary: 'B-trees trade write cost for sorted, logarithmic range access.' },
      interviewAnswerDetailed: { overview: 'B-tree indexes store sorted keys in a balanced tree with linked leaves.', keyPoints: ['logarithmic descent', 'ordered leaf pages', 'covering scans'], algorithmOrApproach: 'Seek the range start, then walk the linked leaf chain.', complexity: 'O(log n) seek, O(k) scan for k matching rows.', edgeCases: ['prefix-only usage for leftmost column', 'implicit type casts breaking seek'], commonMistakes: ['assuming clustered order', 'ignoring selectivity'], whyItMatters: 'Range performance is a core SQL competency.', followUpQuestions: ['When would a hash index be better?'], summary: 'B-trees make ranges efficient by keeping keys sorted.' },
    },
    {
      question: 'When should you denormalize a relational schema for read performance?',
      topic: 'SQL', subtopic: 'Modeling', concepts: ['normalization', 'denormalization'],
      difficulty: 'HARD', questionType: 'TRADE_OFF', archetype: 'TRADE_OFF',
      interviewPriority: 'HIGH', resumeRelevance: 'LOW', expectedAnswerDepth: 'DEEP',
      estimatedAnswerTimeSeconds: 180, provenance: 'CURATED', qualityStatus: 'approved',
      detailedAnswer: 'Denormalize when a measured read path justifies duplicated data, with writes kept consistent by explicit invariants, because normal forms optimize update integrity rather than read latency.',
    },
    {
      question: 'Reverse a linked list in place and state the complexity.',
      topic: 'Data Structures', subtopic: 'Linked Lists', concepts: ['linked list', 'pointers'],
      difficulty: 'EASY', questionType: 'CODING', archetype: 'IMPLEMENTATION',
      interviewPriority: 'MEDIUM', resumeRelevance: 'LOW', expectedAnswerDepth: 'MODERATE',
      estimatedAnswerTimeSeconds: 600, provenance: 'CURATED', qualityStatus: 'approved',
      isCoding: true,
      codingProblem: {
        description: 'Given the head of a singly linked list, reverse the list in place and return the new head.',
        constraints: ['0 <= n <= 10^4 nodes'],
        examples: [{ input: '1->2->3', output: '3->2->1' }],
        starterCode: 'function reverseList(head) {\n}',
        solutionCode: 'let prev = null; while (head) { const next = head.next; head.next = prev; prev = head; head = next; } return prev;',
        complexityTime: 'O(n)', complexitySpace: 'O(1)', pattern: 'Two Pointers',
      },
    },
  ]);

  // 1) Topics list includes SQL and Coding as separate topics.
  const list = await agent.get('/api/topics');
  expect(list.status).toBe(200);
  const names = list.body.data.map((t: any) => t.topic);
  expect(names).toContain('SQL');
  expect(names).toContain('Coding');

  // 2) Start a practice set on SQL filtered to hard+.
  const practice = await agent.post('/api/topics/practice').send({ topic: 'SQL', type: 'practical', count: 10 });
  expect(practice.status).toBe(200);
  const qs = practice.body.data.questions;
  expect(qs.length).toBe(2);
  expect(qs.every((q: any) => q.topic === 'SQL' && !q.isCoding)).toBe(true);
  expect(qs.every((q: any) => ['MEDIUM', 'HARD', 'EXPERT'].includes(q.difficulty))).toBe(true);
  const firstId = qs[0].id;

  // 3) Each practice question landed in today's calendar with questionId metadata.
  const day = await agent.get('/api/calendar/today');
  expect(day.status).toBe(200);
  const entries = day.body.data.entries.filter((e: any) => e.metadata?.source === 'topic-practice');
  expect(entries.length).toBe(2);
  expect(entries.every((e: any) => e.metadata.questionId)).toBe(true);
  expect(entries.every((e: any) => e.topic === 'SQL')).toBe(true);

  // 4) Answer route serves the cached structured answer for question 1.
  const answer = await agent.get(`/api/topics/questions/${firstId}/answer`);
  expect(answer.status).toBe(200);
  expect(answer.body.data.sections.direct).toBeTruthy();
  expect(answer.body.data.detailed).toBeTruthy();

  // 5) Skip works and is reflected in history.
  const skip = await agent.post(`/api/topics/questions/${firstId}/skip`);
  expect(skip.status).toBe(200);
  expect(skip.body.data.status).toBe('skipped');

  // 6) Feedback kind is accepted.
  const secondId = qs[1].id;
  const feedback = await agent.post(`/api/topics/questions/${secondId}/feedback`).send({ kind: 'too_hard' });
  expect(feedback.status).toBe(200);

  // 7) History endpoint returns the practice rows for the topic.
  const history = await agent.get('/api/topics/history?topic=SQL');
  expect(history.status).toBe(200);
  expect(history.body.data.length).toBeGreaterThanOrEqual(2);
  const skippedRow = history.body.data.find((r: any) => r.questionId === firstId);
  expect(skippedRow.status).toBe('SKIPPED');
  const flaggedRow = history.body.data.find((r: any) => r.questionId === secondId);
  expect(flaggedRow.feedback).toBe('too_hard');

  // 8) Coding topic returns the coding question with its description.
  const coding = await agent.post('/api/topics/practice').send({ topic: 'Coding', type: 'all', count: 5 });
  expect(coding.status).toBe(200);
  const codingQs = coding.body.data.questions;
  expect(codingQs.length).toBe(1);
  expect(codingQs[0].isCoding).toBe(true);
  expect(codingQs[0].codingProblem.description).toContain('singly linked list');

  // 9) Progress endpoint reports the practice activity.
  const progress = await agent.get('/api/topics/progress');
  expect(progress.status).toBe(200);
  const sqlProgress = progress.body.data.find((p: any) => p.topic === 'SQL');
  expect(sqlProgress.attempted).toBeGreaterThanOrEqual(2);

  // 10) The calendar-facing route answers by question id alone (no session needed).
  const byId = await agent.get(`/api/sessions/question/${secondId}/answer`);
  expect(byId.status).toBe(200);
  expect(byId.body.data.legacyAnswer).toContain('Denormalize');
  const badId = await agent.get('/api/sessions/question/000000000000000000000000/answer');
  expect(badId.status).toBe(404);
  const regenerate = await agent.post(`/api/sessions/question/${secondId}/generate-answer`);
  expect(regenerate.status).toBe(200);

  // 11) Difficulty multi-select narrows the bank and is echoed normalized.
  const hardOnly = await agent.post('/api/topics/practice')
    .send({ topic: 'SQL', difficulties: ['HARD'], count: 10 });
  expect(hardOnly.status).toBe(200);
  expect(hardOnly.body.data.difficulties).toEqual(['HARD']);
  expect(hardOnly.body.data.questions.length).toBeGreaterThanOrEqual(1);
  expect(hardOnly.body.data.questions.every((q: any) => q.difficulty === 'HARD')).toBe(true);

  // 12) Question-type multi-select filters on the existing QuestionType enum.
  const conceptualOnly = await agent.post('/api/topics/practice')
    .send({ topic: 'SQL', questionTypes: ['conceptual'], count: 10 });
  expect(conceptualOnly.status).toBe(200);
  expect(conceptualOnly.body.data.questionTypes).toEqual(['conceptual']);
  expect(conceptualOnly.body.data.questions.every((q: any) => q.questionType === 'CONCEPTUAL')).toBe(true);

  // A selection the bank cannot satisfy must not fabricate questions. Without an
  // AI provider configured it degrades to bank results plus an explanation.
  const impossible = await agent.post('/api/topics/practice')
    .send({ topic: 'SQL', difficulties: ['EASY'], count: 5 });
  expect(impossible.status).toBe(200);
  expect(Array.isArray(impossible.body.data.questions)).toBe(true);
  expect(impossible.body.data.generated).toBe(0);
  if (impossible.body.data.questions.length < 5) {
    expect(typeof impossible.body.data.message).toBe('string');
    expect(impossible.body.data.message.length).toBeGreaterThan(0);
  }

  // 13) excludeQuestionIds keeps an already-shown question out of the next batch.
  const excluded = await agent.post('/api/topics/practice')
    .send({ topic: 'SQL', count: 10, excludeQuestionIds: [firstId, secondId] });
  expect(excluded.status).toBe(200);
  expect(excluded.body.data.questions.every((q: any) => q.id !== firstId && q.id !== secondId)).toBe(true);

  // 14) Coding answers carry time/space complexity and the reference solution.
  const codingId = codingQs[0].id;
  const codingAnswer = await agent.get(`/api/topics/questions/${codingId}/answer`);
  expect(codingAnswer.status).toBe(200);
  expect(codingAnswer.body.data.complexityTime).toBe('O(n)');
  expect(codingAnswer.body.data.complexitySpace).toBe('O(1)');
  expect(codingAnswer.body.data.solutionCode).toContain('prev');

  // 15) Past-questions entries expose questionId so the history page can answer.
  const past = await agent.get('/api/profile/past-questions?limit=5');
  expect(past.status).toBe(200);
  const allEntries = (past.body.data.days || []).flatMap((d: any) => d.entries);
  expect(allEntries.length).toBeGreaterThan(0);
  expect(allEntries.some((e: any) => e.questionId)).toBe(true);
});

test('unauthenticated access to topic practice is rejected', async () => {
  const res = await request(app).get('/api/topics');
  expect(res.status).toBe(401);
});
