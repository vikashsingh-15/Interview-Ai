import mongoose, { Schema, Document, Model } from 'mongoose';

// Source type
export type SourceType =
  | 'official_job_description'
  | 'official_careers_page'
  | 'engineering_blog'
  | 'public_interview_prep'
  | 'public_candidate_report'
  | 'engineering_discussion'
  | 'reputable_resource'
  | 'official_documentation';

// Interview round
export type InterviewRound =
  | 'phone_screen'
  | 'technical_screen'
  | 'coding_round'
  | 'system_design'
  | 'behavioral'
  | 'leadership'
  | 'final_round'
  | 'onsite'
  | 'virtual_onsite'
  | 'take_home'
  | 'other';

// Market source
export interface IMarketSource {
  _id: mongoose.Types.ObjectId;

  // Source info
  url: string;
  sourceType: SourceType;
  title: string;
  description?: string;
  author?: string;
  publisher?: string;

  // Retrieval info
  company?: string;
  role?: string;
  level?: string;
  interviewRound?: InterviewRound;

  // Content metadata
  retrievedAt: Date;
  retrievalMethod: string;
  lastCheckedAt?: Date;
  isStillValid: boolean;

  // Extracted patterns
  patterns: Array<{
    type: string;
    description: string;
    frequency: 'rare' | 'occasional' | 'common' | 'very_common';
    confidence: number;
  }>;

  // Tags
  tags: string[];

  // Status
  isValidated: boolean;
  validationNotes?: string;
  isArchived: boolean;
  archivedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IMarketSourceDocument extends IMarketSource, Document {}

// Market Calibration Profile - user's calibration preferences
export interface IMarketCalibrationProfile {
  _id: mongoose.Types.ObjectId;

  userId: mongoose.Types.ObjectId;

  // Calibration preferences
  targetCompanies: Array<{
    company: string;
    weight: number; // 1-10
    interviewRounds: InterviewRound[];
    notes?: string;
  }>;

  roleCalibrations: Array<{
    role: string;
    experienceLevel: string;
    expectedRounds: InterviewRound[];
    typicalDuration: number; // minutes
    codingQuestions: number;
    systemDesignQuestions: number;
    behavioralQuestions: number;
    notes?: string;
  }>;

  // Calibration sources used
  usedSources: mongoose.Types.ObjectId[];

  // Last calibration
  lastCalibratedAt?: Date;
  calibrationVersion?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IMarketCalibrationProfileDocument extends IMarketCalibrationProfile, Document {}

// Market Source Schema
const marketSourceSchema = new Schema<IMarketSource>(
  {
    url: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: [
        'official_job_description',
        'official_careers_page',
        'engineering_blog',
        'public_interview_prep',
        'public_candidate_report',
        'engineering_discussion',
        'reputable_resource',
        'official_documentation'
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    author: String,
    publisher: String,

    company: String,
    role: String,
    level: String,
    interviewRound: {
      type: String,
      enum: [
        'phone_screen', 'technical_screen', 'coding_round', 'system_design',
        'behavioral', 'leadership', 'final_round', 'onsite', 'virtual_onsite',
        'take_home', 'other'
      ],
    },

    retrievedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    retrievalMethod: String,
    lastCheckedAt: Date,
    isStillValid: { type: Boolean, default: true },

    patterns: [{
      type: String,
      description: String,
      frequency: {
        type: String,
        enum: ['rare', 'occasional', 'common', 'very_common'],
        default: 'occasional',
      },
      confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    }],

    tags: [String],

    isValidated: { type: Boolean, default: false },
    validationNotes: String,
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
marketSourceSchema.index({ sourceType: 1 });
marketSourceSchema.index({ company: 1 });
marketSourceSchema.index({ role: 1 });
marketSourceSchema.index({ interviewRound: 1 });
marketSourceSchema.index({ isStillValid: 1, isArchived: 1 });
marketSourceSchema.index({ tags: 1 });
marketSourceSchema.index({ isValidated: 1 });

// Text index
marketSourceSchema.index(
  { title: 'text', description: 'text', patterns: 'text' },
  { weights: { title: 10, description: 5, patterns: 3 } }
);

// Market Calibration Profile Schema
const marketCalibrationProfileSchema = new Schema<IMarketCalibrationProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    targetCompanies: [{
      company: { type: String, required: true },
      weight: { type: Number, min: 1, max: 10, default: 5 },
      interviewRounds: [{
        type: String,
        enum: [
          'phone_screen', 'technical_screen', 'coding_round', 'system_design',
          'behavioral', 'leadership', 'final_round', 'onsite', 'virtual_onsite',
          'take_home', 'other'
        ],
      }],
      notes: String,
    }],

    roleCalibrations: [{
      role: { type: String, required: true },
      experienceLevel: String,
      expectedRounds: [{
        type: String,
        enum: [
          'phone_screen', 'technical_screen', 'coding_round', 'system_design',
          'behavioral', 'leadership', 'final_round', 'onsite', 'virtual_onsite',
          'take_home', 'other'
        ],
      }],
      typicalDuration: Number,
      codingQuestions: Number,
      systemDesignQuestions: Number,
      behavioralQuestions: Number,
      notes: String,
    }],

    usedSources: [{ type: Schema.Types.ObjectId, ref: 'MarketSource' }],

    lastCalibratedAt: Date,
    calibrationVersion: String,
  },
  {
    timestamps: true,
  }
);

// Static methods
marketSourceSchema.statics.findByCompany = function(company: string) {
  return this.find({ company, isStillValid: true, isArchived: false })
    .sort({ retrievedAt: -1 });
};

marketSourceSchema.statics.findByRole = function(role: string) {
  return this.find({ role, isStillValid: true, isArchived: false })
    .sort({ retrievedAt: -1 });
};

marketSourceSchema.statics.findValidSources = function(limit: number = 50) {
  return this.find({
    isStillValid: true,
    isArchived: false,
    isValidated: true,
  })
    .sort({ retrievedAt: -1 })
    .limit(limit);
};

marketSourceSchema.statics.upsertSource = async function(source: Partial<IMarketSource>) {
  const existing = await this.findOne({ url: source.url });

  if (existing) {
    existing.title = source.title || existing.title;
    existing.description = source.description || existing.description;
    existing.sourceType = source.sourceType || existing.sourceType;
    existing.company = source.company ?? existing.company;
    existing.role = source.role ?? existing.role;
    existing.level = source.level ?? existing.level;
    existing.interviewRound = source.interviewRound ?? existing.interviewRound;
    existing.isStillValid = source.isStillValid ?? true;
    existing.lastCheckedAt = new Date();
    existing.tags = source.tags ?? existing.tags;

    if (source.patterns) {
      existing.patterns = [
        ...existing.patterns,
        ...source.patterns.filter(
          p => !existing.patterns.some(existingP => existingP.description === p.description)
        ),
      ];
    }

    await existing.save();
    return existing;
  }

  return this.create(source);
};

marketCalibrationProfileSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({ userId });
};

marketCalibrationProfileSchema.statics.createForUser = async function(userId: mongoose.Types.ObjectId) {
  return this.create({ userId });
};

marketCalibrationProfileSchema.methods.addTargetCompany = async function(
  company: string,
  weight: number,
  interviewRounds: InterviewRound[] = []
) {
  const existing = this.targetCompanies.find(c => c.company === company);

  if (existing) {
    existing.weight = weight;
    if (interviewRounds.length > 0) {
      existing.interviewRounds = interviewRounds;
    }
  } else {
    this.targetCompanies.push({ company, weight, interviewRounds });
  }

  await this.save();
  return this;
};

marketCalibrationProfileSchema.methods.addTargetRole = async function(
  role: string,
  experienceLevel: string,
  expectedRounds: InterviewRound[],
  codingQuestions: number,
  systemDesignQuestions: number,
  behavioralQuestions: number
) {
  this.roleCalibrations.push({
    role,
    experienceLevel,
    expectedRounds,
    codingQuestions,
    systemDesignQuestions,
    behavioralQuestions,
  });

  await this.save();
  return this;
};

// Create models
const MarketSource: Model<IMarketSourceDocument> = mongoose.model<IMarketSourceDocument>('MarketSource', marketSourceSchema as any);
const MarketCalibrationProfile: Model<IMarketCalibrationProfileDocument> = mongoose.model<IMarketCalibrationProfileDocument>('MarketCalibrationProfile', marketCalibrationProfileSchema as any);

export { MarketSource, MarketCalibrationProfile };
export default MarketSource;
