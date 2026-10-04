import config from '../../src/config';
import { validateLocalConfig } from '../../src/config/validate';
import { UserProgress } from '../../src/modules/analytics/progress-analytics.model';
import { reviewSchema } from '../../src/modules/profile/onboarding.routes';

test('hosted Atlas URIs are allowed locally; invalid ports and proxy counts are rejected', () => {
  const old = { port: config.port, uri: config.database.uri, hops: config.trustProxyHops };
  try {
    config.port = 3001; config.database.uri = 'mongodb+srv://example.mongodb.net/test'; config.trustProxyHops = 0;
    expect(() => validateLocalConfig()).not.toThrow();
    config.port = 0;
    expect(() => validateLocalConfig()).toThrow('Invalid PORT');
    config.port = 3001; config.trustProxyHops = -1;
    expect(() => validateLocalConfig()).toThrow('TRUST_PROXY_HOPS');
  } finally { config.port = old.port; config.database.uri = old.uri; config.trustProxyHops = old.hops; }
});

test('analytics increments the total and type count once per question', () => {
  const progress = new UserProgress({ userId: '000000000000000000000001' });
  (progress as any).incrementQuestion('new', 'MEDIUM', 'CONCEPTUAL');
  expect(progress.totalQuestions).toBe(1);
  expect(progress.totalNewQuestions).toBe(1);
  (progress as any).incrementQuestion('project', 'HARD', 'IMPLEMENTATION');
  expect(progress.totalQuestions).toBe(2);
  expect(progress.totalProjectQuestions).toBe(1);
});

test('resume review preserves embedded experience and project identifiers', () => {
  const _id = '000000000000000000000001';
  const result = reviewSchema.parse({ skills: [], experience: [{ _id, company: 'TCS', role: 'Engineer', isConfirmed: true }],
    projects: [{ _id, name: 'Cortex', description: 'Actual work' }] });
  expect(result.experience[0]._id).toBe(_id);
  expect(result.projects[0]._id).toBe(_id);
});
