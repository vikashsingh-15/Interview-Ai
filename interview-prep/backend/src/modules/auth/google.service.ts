import { OAuth2Client } from 'google-auth-library';
import mongoose, { Schema } from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import config from '../../config';
import User from './user.model';
import { createSession, hashToken } from '../../common/middleware/auth';
import { ConflictError, UnauthorizedError } from '../../common/filters/error-filter';

const stateSchema = new Schema({ stateHash: { type: String, unique: true }, verifier: String,
  nonce: String, linkUserId: String, mobileChallenge: String, expiresAt: Date });
stateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const OAuthState = mongoose.model('OAuthState', stateSchema);
const oauthClient = () => new OAuth2Client(config.google.clientId, config.google.clientSecret, config.google.callbackUrl);
export const googleAuth = {
  configured() { return Boolean(config.google.clientId && config.google.clientSecret); },
  async begin(linkUserId?: string, mobileChallenge?: string) {
    if (!this.configured()) throw new ConflictError('Google login is not configured');
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    await OAuthState.create({ stateHash: hashToken(state), verifier, nonce, linkUserId, mobileChallenge,
      expiresAt: new Date(Date.now() + 10 * 60000) });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    Object.entries({ client_id: config.google.clientId, redirect_uri: config.google.callbackUrl,
      response_type: 'code', scope: 'openid email profile', state, nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })
      .forEach(([key, value]) => url.searchParams.set(key, value));
    return { url: url.toString(), state };
  },
  async callback(code: string, state: string, cookieState: string, userAgent: string) {
    if (!code || !state || state !== cookieState) throw new UnauthorizedError('Invalid OAuth state');
    const saved = await OAuthState.findOneAndDelete({ stateHash: hashToken(state), expiresAt: { $gt: new Date() } });
    if (!saved?.verifier) throw new UnauthorizedError('OAuth request expired or already used');
    const client = oauthClient();
    const { tokens } = await client.getToken({ code, codeVerifier: saved.verifier });
    if (!tokens.id_token) throw new UnauthorizedError('Google identity missing');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.google.clientId });
    const identity = ticket.getPayload();
    if (!identity?.email || !identity.email_verified || !identity.sub || (identity as any).nonce !== saved.nonce)
      throw new UnauthorizedError('Google identity is not verified');
    let user = await User.findOne({ googleId: identity.sub });
    if (saved.linkUserId) {
      const target = await User.findById(saved.linkUserId);
      if (!target || target.isAccountDeleted || !target.isEmailVerified || target.email !== identity.email.toLowerCase() ||
          user && String(user._id) !== saved.linkUserId) throw new ConflictError('Accounts cannot be linked');
      user = target;
      user.googleId = identity.sub;
      await user.save();
    } else if (!user) {
      if (await User.exists({ email: identity.email.toLowerCase() })) {
        throw new ConflictError('This existing account must be explicitly linked to Google before switching to Google-only sign-in.');
      }
      user = await User.create({ email: identity.email.toLowerCase(), name: identity.name || identity.email,
        googleId: identity.sub, isEmailVerified: true });
    }
    if (user.isAccountDeleted) throw new UnauthorizedError('Account deleted');
    // The system browser proves Google identity. The app receives its own session
    // only after the one-time, PKCE-bound handoff is redeemed.
    if (saved.mobileChallenge) return { userId: String(user._id), mobileChallenge: saved.mobileChallenge };
    const sessionToken = await createSession(String(user._id), userAgent);
    return { sessionToken, userId: String(user._id) };
  },
};
