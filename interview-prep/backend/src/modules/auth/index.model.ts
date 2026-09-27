// Auth models
export { default as User } from './user.model';
export { default as UserModel } from './user.model';
export type { IUser, IUserDocument } from './user.model';

// Session/Auth Token model
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISession {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string;
  refreshToken?: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface ISessionDocument extends ISession, Document {}

const sessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    refreshToken: String,
    deviceInfo: String,
    ipAddress: String,
    userAgent: String,
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

sessionSchema.index({ userId: 1, expiresAt: 1 });
sessionSchema.index({ token: 1 }, { unique: true });
sessionSchema.index({ userId: 1, isActive: 1 });

const Session: Model<ISessionDocument> = mongoose.model<ISessionDocument>('Session', sessionSchema as any);

export { Session };
