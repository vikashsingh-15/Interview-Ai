import { test, expect } from '@playwright/test';

const id = '000000000000000000000001';
const questionId = '000000000000000000000002';
const claim = 'Developed Spring Boot services integrating CyberArk REST APIs';
const question = { id: questionId, question: `You mentioned: ${claim}. Explain your integration and ownership.`, topic: 'TCS — Engineer',
  subtopic: 'Integration', concepts: ['Spring Boot'], difficulty: 'HARD', questionType: 'WHY', archetype: 'DEEP_DIVE', status: 'NEW' };

test('experience practice sends source and configuration, shows answers and saves feedback', async ({ page }) => {
  let submitted: any;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: any = [];
    if (path === '/api/auth/me') data = { id: 'fixture-user', name: 'Fixture User', email: 'fixture@example.test' };
    else if (path === '/api/topics/experience') data = [{ _id: id, company: 'TCS', role: 'Engineer', currentRole: true, isConfirmed: true,
      technologies: ['Java', 'Spring Boot', 'CyberArk'], responsibilities: [claim], achievements: [], technicalClaims: [claim] }];
    else if (path.startsWith('/api/topics/source/')) data = { kind: 'experience', id, label: 'TCS — Engineer', questions: [] };
    else if (path === '/api/topics/practice') { submitted = route.request().postDataJSON(); data = { questions: [question], generated: 1 }; }
    else if (path.endsWith('/answer')) data = { legacyAnswer: 'Explain the endpoints you integrated, the authentication flow and error handling from your actual implementation.' };
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/experience');
  await expect(page.getByRole('heading', { name: 'TCS', exact: true })).toBeVisible();
  await expect(page.getByText(claim, { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Practice this experience' }).click();
  await page.getByRole('button', { name: 'Practice this experience', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Hard', { exact: true }).check();
  await dialog.getByLabel('Resume Deep Dive', { exact: false }).check();
  await dialog.getByLabel('5', { exact: true }).check();
  await dialog.getByRole('button', { name: /Start/ }).click();
  await expect(page.getByText(question.question, { exact: true })).toBeVisible();
  expect(submitted.source).toEqual({ kind: 'experience', id });
  expect(submitted.difficulties).toEqual(['HARD']);
  expect(submitted.questionTypes).toEqual(['resume_deep_dive']);
  expect(submitted.count).toBe(5);
  await page.getByRole('button', { name: 'Show saved answer' }).click();
  await expect(page.getByText(/Explain the endpoints you integrated/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Feedback', exact: true }).selectOption('need_revision');
  await expect(page.getByText('Feedback saved.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/experience-practice.png', fullPage: true });
});

test('project practice link carries the selected project identifier', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/auth/me' ? { id: 'fixture-user', name: 'Fixture User', email: 'fixture@example.test' }
      : path === '/api/projects' ? [{ _id: id, name: 'Cortex', description: 'A RAG research assistant', status: 'active', technologies: ['Pinecone'] }] : [];
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/projects');
  await expect(page.getByRole('link', { name: 'Practice this project' })).toHaveAttribute('href', `/practice/project/${id}`);
});
