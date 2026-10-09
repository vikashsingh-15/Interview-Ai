import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../../src/index';
import User from '../../src/modules/auth/user.model';
import { mobileHandoff } from '../../src/modules/auth/mobile-handoff.service';
import config from '../../src/config';
import { hashToken } from '../../src/common/middleware/auth';

const mockGetToken = jest.fn();
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn().mockImplementation(() => ({
  getToken: mockGetToken, verifyIdToken: mockVerifyIdToken,
})) }));

jest.setTimeout(120000);
let db: MongoMemoryServer;
let userId: string;
const verifier = 'v'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');

beforeAll(async () => {
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  const user = await User.create({ email: 'jobprep@example.test', name: 'JobPrep tester',
    googleId: 'jobprep-google-id', isEmailVerified: true });
  userId = String(user._id);
});
afterAll(async () => { await mongoose.disconnect(); await db.stop(); });

test('mobile Google start keeps the existing HTTPS callback and binds an app challenge', async () => {
  const response = await request(app).get('/api/auth/google/mobile').query({ challenge });
  expect(response.status).toBe(302);
  const target = new URL(response.headers.location);
  expect(target.origin).toBe('https://accounts.google.com');
  expect(target.searchParams.get('redirect_uri')).toBe(config.google.callbackUrl);
  expect(String(response.headers['set-cookie']).includes('oauth_state=')).toBe(true);
  const malformed = await request(app).get('/api/auth/google/mobile').query({ challenge: 'weak' });
  expect(malformed.status).toBe(400);
});

test('mobile code is one-time and verifier-bound; exchange issues the existing session cookie', async () => {
  const wrongCode = await mobileHandoff.issue(userId, challenge);
  await expect(mobileHandoff.redeem(wrongCode, 'x'.repeat(43))).rejects.toThrow('Invalid mobile sign-in verifier');
  await expect(mobileHandoff.redeem(wrongCode, verifier)).rejects.toThrow('expired');

  const code = await mobileHandoff.issue(userId, challenge);
  const exchange = await request(app).post('/api/auth/mobile/exchange').send({ code, verifier });
  expect(exchange.status).toBe(200);
  const setCookies = exchange.headers['set-cookie'] as unknown as string[];
  const cookie = setCookies.find((entry) => entry.startsWith(config.auth.cookieName + '='));
  expect(cookie).toBeDefined();
  expect(cookie).toContain('HttpOnly');
  const me = await request(app).get('/api/auth/me').set('Cookie', cookie!.split(';')[0]);
  expect(me.status).toBe(200);
  expect(me.body.data.email).toBe('jobprep@example.test');
  const replay = await request(app).post('/api/auth/mobile/exchange').send({ code, verifier });
  expect(replay.status).toBe(401);
});

test('Google callback returns a verifier-bound app code without creating a browser session', async () => {
  const start = await request(app).get('/api/auth/google/mobile').query({ challenge });
  expect(start.status).toBe(302);
  const state = new URL(start.headers.location).searchParams.get('state')!;
  const stored: any = await mongoose.model('OAuthState').findOne({ stateHash: hashToken(state) });
  mockGetToken.mockResolvedValue({ tokens: { id_token: 'fixture-id-token' } });
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({
    sub: 'jobprep-google-id', email: 'jobprep@example.test', email_verified: true,
    name: 'JobPrep tester', nonce: stored.nonce,
  }) });
  const stateCookie = (start.headers['set-cookie'] as unknown as string[])
    .find((entry) => entry.startsWith('oauth_state='))!.split(';')[0];
  const callback = await request(app).get('/api/auth/google/callback')
    .query({ code: 'fixture-code', state }).set('Cookie', stateCookie);
  expect(callback.status).toBe(302);
  expect(callback.headers.location.startsWith('jobprep://auth?code=')).toBe(true);
  expect(String(callback.headers['set-cookie'])).not.toContain(config.auth.cookieName + '=');
  const code = new URL(callback.headers.location).searchParams.get('code');
  const exchange = await request(app).post('/api/auth/mobile/exchange').send({ code, verifier });
  expect(exchange.status).toBe(200);
});
