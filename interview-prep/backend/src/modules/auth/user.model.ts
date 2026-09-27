import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config';

// Interfaces
export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  isAccountDeleted: boolean;
  accountDeletedAt?: Date;
  preferences: {
    dailyQuestions: number;
    codingCount: number;
    systemDesignCount: number;
    projectQuestions: number;
    studyDays: number;
    focusTopics: string[];
    excludedTopics: string[];
    revisionFrequency: 'daily' | 'weekly' | 'biweekly';
    mockInterviewDuration: number;
    notifyEmail: boolean;
    notifyBrowser: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
}

// Schema
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    isAccountDeleted: {
      type: Boolean,
      default: false,
    },
    accountDeletedAt: Date,
    preferences: {
      dailyQuestions: { type: Number, default: 10 },
      codingCount: { type: Number, default: 2 },
      systemDesignCount: { type: Number, default: 2 },
      projectQuestions: { type: Number, default: 5 },
      studyDays: { type: Number, default: 90 },
      focusTopics: { type: [String], default: [] },
      excludedTopics: { type: [String], default: [] },
      revisionFrequency: { type: String, enum: ['daily', 'weekly', 'biweekly'], default: 'daily' },
      mockInterviewDuration: { type: Number, default: 45 },
      notifyEmail: { type: Boolean, default: true },
      notifyBrowser: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ isAccountDeleted: 1, emailVerificationToken: 1 });

// Methods
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.hashPassword = async function(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(config.auth.bcryptRounds);
  return bcrypt.hash(password, salt);
};

// Pre-save hook for password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }
  // If passwordHash looks like a plain password (not already hashed), hash it
  if (this.passwordHash && !this.passwordHash.startsWith('$2')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, config.auth.bcryptRounds);
  }
  next();
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Static methods
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email, isAccountDeleted: false }).select('+passwordHash');
};

userSchema.statics.findActive = function() {
  return this.find({ isAccountDeleted: false });
};

// Create model
const User: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema as any);

export default User;
