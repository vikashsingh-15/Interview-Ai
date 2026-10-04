/** @type {import('jest').Config} */
// Opt-in suite for tests that call a real AI provider. Unlike the default
// jest.config.js (whose setup blanks AI_API_KEY), this loads the project .env.
// Run: npx jest -c jest.live.config.js --no-coverage --forceExit
module.exports = {
  ...require('./jest.config.js'),
  setupFiles: ['<rootDir>/tests/setup.live.ts'],
  testMatch: ['<rootDir>/tests/**/topic-practice-live.test.ts'],
};
