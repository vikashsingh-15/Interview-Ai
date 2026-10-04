import mongoose, { Schema, Document, Model } from 'mongoose';

// Interfaces
export interface IResumeVersion {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  storageProvider?: string;
  versionNumber: number;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  storageKey: string;
  checksum: string;
  parsed: boolean;
  parseStatus: 'pending' | 'processing' | 'completed' | 'failed';
  parsedAt?: Date;
  parsedBy?: string;
  parserVersion?: string;
  filePath?: string;
  createdAt: Date;
}

export interface IResumeVersionDocument extends IResumeVersion, Document {}

export interface IResume {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  currentVersionId?: mongoose.Types.ObjectId;
  versions: mongoose.Types.ObjectId[];
  uploadDate: Date;
  totalVersions: number;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IResumeDocument extends IResume, Document {}

// Resume Version Schema
const resumeVersionSchema = new Schema<IResumeVersion>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    // Historical labels remain readable; new uploads explicitly select GridFS.
    storageProvider: { type: String },
    versionNumber: {
      type: Number,
      required: true,
      index: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
      index: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    storagePath: String,
    storageKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    checksum: {
      type: String,
      required: true,
      index: true,
    },
    parsed: {
      type: Boolean,
      default: false,
    },
    parseStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    parsedAt: Date,
    parsedBy: String,
    parserVersion: String,
    filePath: String,
  },
  {
    timestamps: true,
  }
);

resumeVersionSchema.index({ userId: 1, versionNumber: 1 }, { unique: true });
resumeVersionSchema.index({ userId: 1, storageKey: 1 });

// Resume Schema
// One resume document per uploaded resume (user may have multiple).
// NOTE: userId is NOT unique here. Multiple Resume documents may share a
// userId so a user can upload and manage several resumes (e.g. a SE role,
// a DevOps role) and select the one that drives the next session.
const resumeSchema = new Schema<IResume>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currentVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'ResumeVersion',
    },
    versions: [{
      type: Schema.Types.ObjectId,
      ref: 'ResumeVersion',
    }],
    uploadDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    totalVersions: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

resumeSchema.index({ userId: 1, isDeleted: 1 });

// Methods
resumeSchema.methods.addVersion = async function(version: IResumeVersionDocument) {
  this.versions.push(version._id);
  this.currentVersionId = version._id;
  this.totalVersions += 1;
  return this.save();
};

// Create models
const ResumeVersion: Model<IResumeVersionDocument> = mongoose.model<IResumeVersionDocument>('ResumeVersion', resumeVersionSchema as any);
const Resume: Model<IResumeDocument> = mongoose.model<IResumeDocument>('Resume', resumeSchema as any);

export { ResumeVersion, Resume };
export default Resume;
