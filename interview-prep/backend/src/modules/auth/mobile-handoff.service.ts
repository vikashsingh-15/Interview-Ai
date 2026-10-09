import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import mongoose, { Schema } from 'mongoose';
import { hashToken } from '../../common/middleware/auth';
import { UnauthorizedError } from '../../common/filters/error-filter';

const handoffSchema = new Schema({
  codeHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  challenge: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});
handoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const MobileHandoff = mongoose.model('MobileHandoff', handoffSchema);

export const mobileHandoff = {
  async issue(userId: string, challenge: string): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    await MobileHandoff.create({ codeHash: hashToken(code), userId, challenge,
      expiresAt: new Date(Date.now() + 2 * 60_000) });
    return code;
  },
  async redeem(code: string, verifier: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier))
      throw new UnauthorizedError('Invalid mobile sign-in handoff');
    const entry = await MobileHandoff.findOneAndDelete({ codeHash: hashToken(code), expiresAt: { $gt: new Date() } });
    if (!entry) throw new UnauthorizedError('Mobile sign-in handoff expired');
    const actual = createHash('sha256').update(verifier).digest('base64url');
    const expected = Buffer.from(entry.challenge, 'utf8');
    if (expected.length !== actual.length || !timingSafeEqual(expected, Buffer.from(actual, 'utf8')))
      throw new UnauthorizedError('Invalid mobile sign-in verifier');
    return String(entry.userId);
  },
};
