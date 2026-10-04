import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import config from '../../src/config';
import { app } from '../../src/index';
import { createSession } from '../../src/common/middleware/auth';
import User from '../../src/modules/auth/user.model';
import DailyRecord from '../../src/modules/calendar/daily-record.model';

jest.setTimeout(120000);
let database: MongoMemoryServer;
let ownerAgent: ReturnType<typeof request.agent>;
let otherAgent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  database = await MongoMemoryServer.create();
  process.env.MONGODB_URI = database.getUri();
  await mongoose.connect(database.getUri());
  const [owner, other] = await User.create([
    { email: 'tracker-owner@example.test', name: 'Tracker Owner', googleId: 'tracker-owner', isEmailVerified: true },
    { email: 'tracker-other@example.test', name: 'Tracker Other', googleId: 'tracker-other', isEmailVerified: true },
  ]);
  ownerAgent = request.agent(app);
  otherAgent = request.agent(app);
  ownerAgent.set('Cookie', `${config.auth.cookieName}=${await createSession(String(owner._id))}`);
  otherAgent.set('Cookie', `${config.auth.cookieName}=${await createSession(String(other._id))}`);
});

afterAll(async () => {
  await mongoose.disconnect();
  await database.stop();
});

test('tracker defaults, interview suggestions, entry updates, and ownership are safe', async () => {
  const taskResponse = await ownerAgent.get('/api/tracker/tasks');
  expect(taskResponse.status).toBe(200);
  expect(taskResponse.body.data).toHaveLength(6);
  expect((await ownerAgent.get('/api/tracker/tasks')).body.data).toHaveLength(6);
  const task = taskResponse.body.data.find((item: any) => item.systemKey === 'interview-practice');
  const otherTasks = await otherAgent.get('/api/tracker/tasks');
  expect(otherTasks.status).toBe(200);
  const otherTaskId = otherTasks.body.data[0]._id;

  const dateKey = new Date().toISOString().slice(0, 10);
  await DailyRecord.create({
    userId: new mongoose.Types.ObjectId(taskResponse.body.data[0].userId),
    date: new Date(`${dateKey}T00:00:00.000Z`), dateKey,
    entries: [
      { type: 'coding', title: 'Problem A', count: 1, occurredAt: new Date() },
      { type: 'technical', title: 'Question B', count: 3, occurredAt: new Date() },
      { type: 'search', title: 'Ignored search', count: 20, occurredAt: new Date() },
    ],
  });
  const today = await ownerAgent.get('/api/tracker/today');
  expect(today.status).toBe(200);
  expect(today.body.data.suggestedInterviewQuestions).toBe(4);
  expect(today.body.data.entries.find((entry: any) => entry.taskId === task._id).actual).toBe(0);

  const saved = await ownerAgent.post('/api/tracker/entries').send({ taskId: task._id, dateKey, actual: 4 });
  expect(saved.status).toBe(201);
  expect(saved.body.data.target).toBe(task.targetValue);
  expect(saved.body.data.completed).toBe(false);
  const ownerEntryId = saved.body.data._id;
  expect((await otherAgent.put(`/api/tracker/tasks/${task._id}`).send({ name: 'stolen' })).status).toBe(404);
  expect((await otherAgent.delete(`/api/tracker/entries/${ownerEntryId}`)).status).toBe(404);
  expect((await otherAgent.post('/api/tracker/entries').send({ taskId: task._id, dateKey, actual: 10 })).status).toBe(404);
  expect((await ownerAgent.delete(`/api/tracker/tasks/${otherTaskId}`)).status).toBe(404);
});

test('planner tasks are owner-scoped and carry-forward is idempotent', async () => {
  const created = await ownerAgent.post('/api/planner/tasks').send({ year: 2026, month: 10, week: 1, title: 'Review system design', priority: 'high' });
  expect(created.status).toBe(201);
  expect(created.body.data.completed).toBe(false);
  const taskId = created.body.data._id;
  const firstCopy = await ownerAgent.post(`/api/planner/tasks/${taskId}/carry-forward`).send({ year: 2026, month: 10, week: 2 });
  const secondCopy = await ownerAgent.post(`/api/planner/tasks/${taskId}/carry-forward`).send({ year: 2026, month: 10, week: 2 });
  expect(firstCopy.status).toBe(200);
  expect(secondCopy.body.data._id).toBe(firstCopy.body.data._id);
  expect((await otherAgent.delete(`/api/planner/tasks/${taskId}`)).status).toBe(404);
  expect((await ownerAgent.put(`/api/planner/tasks/${taskId}`).send({ priority: 'urgent' })).status).toBe(400);
});
