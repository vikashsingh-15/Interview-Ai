import mongoose, { Schema, Document, Model } from 'mongoose';

// Interfaces
export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash?: string; // Hidden legacy data; password authentication is removed.
  name: string;
  googleId?: string;
  role: 'user' | 'admin';
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

export interface IUserDocument extends IUser, Document {}

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
    googleId: { type: String, unique: true, sparse: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    passwordHash: {
      type: String,
      required: false,
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
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: Date,
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: Date,
    isAccountDeleted: {
      type: Boolean,
      default: false,
    },
    accountDeletedAt: Date,
    preferences: {
      dailyQuestions: { type: Number, default: 5 },
      codingCount: { type: Number, default: 0 },
      systemDesignCount: { type: Number, default: 0 },
      projectQuestions: { type: Number, default: 0 },
      studyDays: { type: Number, default: 90 },
      focusTopics: { type: [String], default: [] },
      excludedTopics: { type: [String], default: [] },
      revisionFrequency: { type: String, enum: ['daily', 'weekly', 'biweekly'], default: 'daily' },
      mockInterviewDuration: { type: Number, default: 45 },
      notifyEmail: { type: Boolean, default: false },
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
userSchema.index({ isAccountDeleted: 1, emailVerificationToken: 1 });

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
