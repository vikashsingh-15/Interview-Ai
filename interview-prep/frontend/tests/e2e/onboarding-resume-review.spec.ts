import { test, expect } from '@playwright/test';

const existingProjectId = '000000000000000000000011';
const addedProjectId = '000000000000000000000012';
const resumeFacts = {
  _id: '000000000000000000000010',
  resumeVersionId: '000000000000000000000020',
  fullName: 'Fixture Candidate',
  currentRole: 'Engineer',
  totalExperienceMonths: 24,
  userModified: false,
  skills: [{ _id: '000000000000000000000013', name: 'TypeScript', category: 'programming_language', confidence: 0.8, isConfirmed: true, isRemoved: false }],
  experience: [],
  projects: [{ _id: existingProjectId, name: 'Existing Project', description: 'A real project.', technologies: [], responsibilities: [], architectureClaims: [], features: [], performanceClaims: [], metrics: [], securityClaims: [], technicalDecisions: [], isConfirmed: true, isRemoved: false }],
};

test('active resume review can add a project and unlock practice after saving', async ({ page }) => {
  let savedReview: any;
  let onboardingSaved = false;
  let sessionStarted = false;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let data: any = {};
    if (path === '/api/auth/me') data = { id: 'fixture-user', name: 'Fixture Candidate', email: 'fixture@example.test' };
    else if (path === '/api/profile/onboarding' && method === 'GET') data = {
      resume: { resume: { id: 'active-resume', isActive: true }, profile: resumeFacts }, profile: null,
    };
    else if (path === '/api/profile/review' && method === 'PUT') {
      savedReview = route.request().postDataJSON();
      data = { ...savedReview, _id: resumeFacts._id, resumeVersionId: resumeFacts.resumeVersionId,
        experience: savedReview.experience.map((entry: any) => ({ ...entry, _id: entry._id || '000000000000000000000014' })),
        projects: savedReview.projects.map((entry: any) => ({ ...entry, _id: entry._id || addedProjectId })) };
    } else if (path === '/api/profile/onboarding' && method === 'POST') { onboardingSaved = true; data = { onboardingCompleted: true }; }
    else if (path === '/api/sessions/generate' && method === 'POST') { sessionStarted = true; data = { id: 'session' }; }
    await route.fulfill({ json: { success: true, data } });
  });

  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: '2. Review extracted facts' })).toBeVisible();
  const startPractice = page.getByRole('button', { name: 'Save profile and start practice' });
  await expect(startPractice).toBeDisabled();

  await page.getByRole('button', { name: 'Add project' }).click();
  await page.getByLabel('Project name').nth(1).fill('New Verified Project');
  await page.getByLabel('Description').nth(1).fill('A project I personally built.');
  await page.getByLabel('Confirm this edited entry and its claims').nth(1).check();
  await page.getByRole('button', { name: 'Save reviewed facts' }).click();
  await expect(page.getByText('Review saved. Only confirmed entries will personalize questions.')).toBeVisible();
  expect(savedReview.projects).toHaveLength(2);
  expect(savedReview.projects[1]._id).toBeUndefined();
  await expect(startPractice).toBeEnabled();

  await page.getByLabel('Description').nth(1).fill('Updated with my actual contribution.');
  await expect(startPractice).toBeDisabled();
  await page.getByRole('button', { name: 'Save reviewed facts' }).click();
  await expect(startPractice).toBeEnabled();
  await startPractice.click();
  await expect(page).toHaveURL(/\/sessions\/today$/);
  expect(onboardingSaved).toBe(true);
  expect(sessionStarted).toBe(true);
});
