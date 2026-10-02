import mongoose, { Schema, Document, Model } from 'mongoose';

// Experience level
export type ExperienceLevel =
  | 'entry'
  | 'sde1'
  | 'sde2'
  | 'senior'
  | 'staff'
  | 'principal'
  | 'other';

// Target role
export type TargetRole = string
  | 'sde1'
  | 'sde2'
  | 'senior_software_engineer'
  | 'backend_engineer'
  | 'full_stack_engineer'
  | 'java_backend_engineer'
  | 'nodejs_backend_engineer'
  | 'software_engineer'
  | 'platform_engineer'
  | 'cloud_engineer'
  | 'ai_engineer'
  | 'other';

// Target companies (predefined + custom)
export const PREDEFINED_COMPANIES = [
  'amazon',
  'google',
  'microsoft',
  'meta',
  'apple',
  'netflix',
  'atlassian',
  'uber',
  'adobe',
  'salesforce',
  'deloitte',
  'pwc',
  'accenture',
  'ibm',
  'oracle',
  'sap',
  'intel',
  'cisco',
  'twitter',
  'airbnb',
  'dropbox',
  'spotify',
  'stripe',
  'square',
  'palantir',
  'databricks',
  'snowflake',
  'coinbase',
  'other',
] as const;

// Interview preferences
export type DifficultyChoice = 'easy' | 'medium' | 'hard' | 'extra_hard' | 'mixed';

export interface IInterviewPreferences {
  dailyQuestions: number;
  codingCount: number;
  systemDesignCount: number;
  projectQuestions: number;
  /** Preferred difficulty for ALL question types; 'mixed' keeps the default distribution */
  difficulty: DifficultyChoice;
  studyDays: number;
  focusTopics: string[];
  excludedTopics: string[];
  revisionFrequency: 'daily' | 'weekly' | 'biweekly';
  mockInterviewDuration: number;
  systemDesignFocus: ('hld' | 'lld' | 'distributed' | 'backend' | 'fullstack' | 'mobile' | 'data' | 'ml')[];
  codingFocus: ('arrays' | 'strings' | 'linked_lists' | 'trees' | 'graphs' | 'dynamic_programming' | 'backtracking' | 'sorting' | 'searching' | 'greedy' | 'intervals' | 'math' | 'geometry' | 'bit_manipulation' | 'tries' | 'heap' | 'stack' | 'queue' | 'two_pointers' | 'sliding_window' | 'binary_search' | 'union_find' | 'segment_tree' | ' fenwick_tree')[];
  codingLanguages: string[];
  startTimeOfDay: string;
  notificationEnabled: boolean;
}

// Interview Profile
export interface IInterviewProfile {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  resumeProfileId: mongoose.Types.ObjectId;

  // Generated from resume + user input
  experienceLevel: ExperienceLevel;
  targetRole: TargetRole;
  targetLevel?: string;
  actualExperienceMonths?: number;
  industries?: string[];
  interviewTypes?: string[];
  interviewDate?: Date;
  dailyPlan?: Array<{ title: string; topic: string; type: string; count: number }>;
  curriculum?: Array<{ topic: string; source: string; priority: number }>;
  targetCompanies: (typeof PREDEFINED_COMPANIES[number] | string)[];
  customCompanies: string[];
  primaryLanguages: string[];
  frameworks: string[];
  databases: string[];
  cloud: string[];
  aiTechnologies: string[];
  architectureAreas: string[];
  systemDesignLevel: 'basic' | 'intermediate' | 'advanced' | 'expert';
  codingLevel: 'basic' | 'intermediate' | 'advanced';

  // Verified information from resume
  confirmedSkills: string[];
  confirmedProjects: string[];
  confirmedExperience: string[];

  // Preferences
  preferences: IInterviewPreferences;

  // Curriculum metadata
  curriculumGenerated: boolean;
  curriculumGeneratedAt?: Date;
  curriculumVersion?: string;

  // Day 1 metadata
  dayOneGenerated: boolean;
  dayOneGeneratedAt?: Date;
  dayOneDate?: Date;

  // Onboarding
  onboardingCompleted: boolean;
  onboardingCompletedAt?: Date;

  // Created/updated timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IInterviewProfileDocument extends IInterviewProfile, Document {}

// Interview Preferences Schema (subdocument)
const interviewPreferencesSchema = new Schema<IInterviewPreferences>({
  dailyQuestions: { type: Number, default: 10, min: [0, 'Minimum 0'], max: [50, 'Maximum 50'] },
  codingCount: { type: Number, default: 2, min: [0, 'Minimum 0'], max: [10, 'Maximum 10'] },
  systemDesignCount: { type: Number, default: 2, min: [0, 'Minimum 0'], max: [10, 'Maximum 10'] },
  projectQuestions: { type: Number, default: 5, min: [0, 'Minimum 0'], max: [10, 'Maximum 10'] },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'extra_hard', 'mixed'],
    default: 'mixed',
  },
  studyDays: { type: Number, default: 90 },
  focusTopics: { type: [String], default: [] },
  excludedTopics: { type: [String], default: [] },
  revisionFrequency: { type: String, enum: ['daily', 'weekly', 'biweekly'], default: 'daily' },
  mockInterviewDuration: { type: Number, default: 45 },
  systemDesignFocus: {
    type: [String],
    default: ['hld', 'distributed', 'backend'],
    enum: ['hld', 'lld', 'distributed', 'backend', 'fullstack', 'mobile', 'data', 'ml'],
  },
  codingFocus: {
    type: [String],
    default: ['arrays', 'strings', 'trees', 'graphs', 'dynamic_programming', 'two_pointers', 'sliding_window'],
    enum: [
      'arrays', 'strings', 'linked_lists', 'trees', 'graphs', 'dynamic_programming',
      'backtracking', 'sorting', 'searching', 'greedy', 'intervals', 'math',
      'geometry', 'bit_manipulation', 'tries', 'heap', 'stack', 'queue',
      'two_pointers', 'sliding_window', 'binary_search', 'union_find',
      'segment_tree', 'fenwick_tree'
    ],
  },
  codingLanguages: { type: [String], default: [] },
  startTimeOfDay: { type: String, default: 'morning' },
  notificationEnabled: { type: Boolean, default: true },
});

// Interview Profile Schema
const interviewProfileSchema = new Schema<IInterviewProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    resumeProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'ResumeProfile',
      required: true,
      index: true,
    },

    // Generated from resume + user input
    experienceLevel: {
      type: String,
      enum: ['entry', 'sde1', 'sde2', 'senior', 'staff', 'principal', 'other'],
      default: 'other',
    },
    targetRole: { type: String, trim: true, maxlength: 150, default: '' },
    targetLevel: { type: String, maxlength: 100, default: '' },
    actualExperienceMonths: { type: Number, min: 0, max: 1200, default: 0 },
    industries: [String],
    interviewTypes: [String],
    interviewDate: Date,
    dailyPlan: [{ title: String, topic: String, type: { type: String }, count: { type: Number, min: 0, max: 50 } }],
    curriculum: [{ topic: String, source: String, priority: Number }],
    targetCompanies: [{ type: String }],
    customCompanies: { type: [String], default: [] },

    // Technical profile derived from resume
    primaryLanguages: { type: [String], default: [] },
    frameworks: { type: [String], default: [] },
    databases: { type: [String], default: [] },
    cloud: { type: [String], default: [] },
    aiTechnologies: { type: [String], default: [] },
    architectureAreas: { type: [String], default: [] },

    // Self-assessed or derived levels
    systemDesignLevel: {
      type: String,
      enum: ['basic', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate',
    },
    codingLevel: {
      type: String,
      enum: ['basic', 'intermediate', 'advanced'],
      default: 'intermediate',
    },

    // Verified information from resume
    confirmedSkills: { type: [String], default: [] },
    confirmedProjects: { type: [String], default: [] },
    confirmedExperience: { type: [String], default: [] },

    // Preferences
    preferences: {
      type: interviewPreferencesSchema,
      default: () => ({}),
    },

    // Curriculum metadata
    curriculumGenerated: { type: Boolean, default: false },
    curriculumGeneratedAt: Date,
    curriculumVersion: String,

    // Day 1 metadata
    dayOneGenerated: { type: Boolean, default: false },
    dayOneGeneratedAt: Date,
    dayOneDate: Date,

    // Onboarding
    onboardingCompleted: { type: Boolean, default: false },
    onboardingCompletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
interviewProfileSchema.index({ userId: 1 }, { unique: true });
interviewProfileSchema.index({ userId: 1, onboardingCompleted: 1 });

// Static methods
interviewProfileSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({ userId, onboardingCompleted: { $ne: false } });
};

interviewProfileSchema.statics.createForUser = async function(
  userId: mongoose.Types.ObjectId,
  resumeProfileId: mongoose.Types.ObjectId
) {
  return this.create({
    userId,
    resumeProfileId,
    experienceLevel: 'other',
    targetRole: '',
    targetCompanies: [],
    onboardingCompleted: false,
  });
};

// Methods
interviewProfileSchema.methods.completeOnboarding = async function() {
  this.onboardingCompleted = true;
  this.onboardingCompletedAt = new Date();
  return this.save();
};

interviewProfileSchema.methods.generateCurriculum = async function() {
  this.curriculumGenerated = true;
  this.curriculumGeneratedAt = new Date();
  this.curriculumVersion = 'v1.0';
  return this.save();
};

interviewProfileSchema.methods.generateDayOne = async function(dayDate: Date) {
  this.dayOneGenerated = true;
  this.dayOneGeneratedAt = new Date();
  this.dayOneDate = dayDate;
  return this.save();
};

// Create model
const InterviewProfile: Model<IInterviewProfileDocument> = mongoose.model<IInterviewProfileDocument>('InterviewProfile', interviewProfileSchema as any);

export { InterviewProfile };
export default InterviewProfile;
