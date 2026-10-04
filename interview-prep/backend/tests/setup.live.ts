/**
 * Setup for the opt-in live suite (see jest.live.config.js).
 *
 * The default tests/setup.ts blanks AI credentials on purpose so the offline
 * suite never calls a provider. A live run needs the real project .env loaded
 * before src/config is imported, hence the override here.
 */
import dotenv from 'dotenv';
import path from 'path';

process.env.NODE_ENV = 'test';
const loaded = dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
if (loaded.error) console.warn('[live setup] no .env found at', path.resolve(__dirname, '../../.env'));
