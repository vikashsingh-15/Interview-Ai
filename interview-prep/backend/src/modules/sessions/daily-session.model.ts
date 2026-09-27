import mongoose, { Schema, Document, Model } from 'mongoose';

// Session status
export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'paused' | 'skipped';

// Section type
export type SectionType =
  | 'technical'
  | 'system_design'
  | 'coding'
  | 'project'
  | 'revision'
  | 'mock_interview'
  | 'behavioral'
  | 'custom';

// Section
export interface ISessionSection {
  _id: mongoose.Types.ObjectId;
  type: SectionType;
  title: string;
  description?: string;
  order: number;
  status: 'pending' | 'in_progress' | 'completed';
  totalQuestions: number;
  completedQuestions: number;
  questions: mongoose.Types.ObjectId[];
  topic?: string;
  subtopic?: string;
  notes?: string;
}

// Session Question mapping
export interface ISessionQuestion {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  sectionId: mongoose.Types.ObjectId;
  order: number;
  status: 'pending' | 'presented' | 'answered' | 'skipped' | 'bookmarked' | 'flagged';
  isRevision: boolean;
  revisionNumber?: number;
  questionSnapshot: {
    question: string;
    topic: string;
    subtopic: string;
    concepts: string[];
    difficulty: string;
    questionType: string;
    archetype: string;
    interviewPriority: string;
    estimatedAnswerTimeSeconds: number;
    isSystemDesign: boolean;
    isCoding: boolean;
    isProjectInterview: boolean;
  };
  answer?: string;
  answerTimeSeconds?: number;
  answerSubmittedAt?: Date;
  evaluation?: any;
  selfAssessedScore?: number;
  aiAssessedScore?: number;
  finalScore?: number;
  userNotes?: string;
  bookmarked: boolean;
  flagged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Daily Session
export interface IDailySession {
  _id: mongoose.Types.ObjectId;

  // User reference
  userId: mongoose.Types.ObjectId;

  // Session identification
  sessionDate: Date;
  userDayNumber: number;

  // Status
  status: SessionStatus;
  startedAt?: Date;
  completedAt?: Date;
  totalTimeSeconds?: number;

  // Sections
  sections: ISessionSection[];

  // Progress summary
  totalQuestions: number;
  completedQuestions: number;
  correctQuestions: number;
  averageScore: number;

  // Resume/Profile context (snapshot at session creation)
  interviewProfileSnapshot?: {
    experienceLevel: string;
    targetRole: string;
    targetCompanies: string[];
    primaryLanguages: string[];
    frameworks: string[];
    databases: string[];
    systemDesignLevel: string;
  };

  // Topic selection rationale
  topicSelectionRationale?: {
    selectedTopic: string;
    reason: string;
    resumeRelevance: boolean;
    weakArea: boolean;
    marketRelevance: boolean;
    coverageGap: boolean;
  };

  // Revision info
  revisionsDue: number;
  revisionsCompleted: number;

  // Flags
  isDeleted: boolean;
  deletedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IDailySessionDocument extends IDailySession, Document {}

// Session Section Schema (subdocument)
const sessionSectionSchema = new Schema<ISessionSection>({
  type: {
    type: String,
    enum: ['technical', 'system_design', 'coding', 'project', 'revision', 'mock_interview', 'behavioral', 'custom'],
    required: true,
  },
  title: { type: String, required: true },
  description: String,
  order: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending',
  },
  totalQuestions: { type: Number, default: 0 },
  completedQuestions: { type: Number, default: 0 },
  questions: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
  topic: String,
  subtopic: String,
  notes: String,
});

// Session Question Schema
const sessionQuestionSchema = new Schema<ISessionQuestion>({
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'DailySession',
    required: true,
    index: true,
  },
  questionId: {
    type: Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
    index: true,
  },
  sectionId: {
    type: Schema.Types.ObjectId,
    ref: 'SessionSection',
    required: true,
    index: true,
  },
  order: { type: Number, required: true },

  status: {
    type: String,
    enum: ['pending', 'presented', 'answered', 'skipped', 'bookmarked', 'flagged'],
    default: 'pending',
  },
  isRevision: { type: Boolean, default: false },
  revisionNumber: Number,

  questionSnapshot: {
    question: { type: String, required: true },
    topic: { type: String, required: true },
    subtopic: { type: String, required: true },
    concepts: [String],
    difficulty: String,
    questionType: String,
    archetype: String,
    interviewPriority: String,
    estimatedAnswerTimeSeconds: Number,
    isSystemDesign: { type: Boolean, default: false },
    isCoding: { type: Boolean, default: false },
    isProjectInterview: { type: Boolean, default: false },
  },

  answer: String,
  answerTimeSeconds: Number,
  answerSubmittedAt: Date,
  evaluation: Schema.Types.Mixed,
  selfAssessedScore: Number,
  aiAssessedScore: Number,
  finalScore: Number,
  userNotes: String,
  bookmarked: { type: Boolean, default: false },
  flagged: { type: Boolean, default: false },
});

// Daily Session Schema
const dailySessionSchema = new Schema<IDailySession>(
  {
    // User reference
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Session identification
    sessionDate: {
      type: Date,
      required: true,
      index: true,
    },
    userDayNumber: {
      type: Number,
      required: true,
      index: true,
    },

    // Status
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'paused', 'skipped'],
      default: 'pending',
      index: true,
    },
    startedAt: Date,
    completedAt: Date,
    totalTimeSeconds: Number,

    // Sections (embedded)
    sections: [sessionSectionSchema],

    // Progress summary
    totalQuestions: { type: Number, default: 0 },
    completedQuestions: { type: Number, default: 0 },
    correctQuestions: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },

    // Interview profile snapshot
    interviewProfileSnapshot: {
      experienceLevel: String,
      targetRole: String,
      targetCompanies: [String],
      primaryLanguages: [String],
      frameworks: [String],
      databases: [String],
      systemDesignLevel: String,
    },

    // Topic selection rationale
    topicSelectionRationale: {
      selectedTopic: String,
      reason: String,
      resumeRelevance: Boolean,
      weakArea: Boolean,
      marketRelevance: Boolean,
      coverageGap: Boolean,
    },

    // Revision info
    revisionsDue: { type: Number, default: 0 },
    revisionsCompleted: { type: Number, default: 0 },

    // Flags
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Unique compound index (critical for idempotency)
dailySessionSchema.index(
  { userId: 1, sessionDate: 1 },
  { unique: true, name: 'unique_user_session_date' }
);

// Additional indexes
dailySessionSchema.index({ userId: 1, userDayNumber: 1 });
dailySessionSchema.index({ userId: 1, status: 1 });
dailySessionSchema.index({ userId: 1, completedAt: -1 });
dailySessionSchema.index({ userId: 1, sessionDate: -1 });
dailySessionSchema.index({ userId: 1, isDeleted: 1 });

// Section indexes (on embedded documents)
dailySessionSchema.index({ 'sections.type': 1, 'sections.status': 1 });
dailySessionSchema.index({ 'sections.topic': 1 });

// Methods
dailySessionSchema.methods.start = async function() {
  this.status = 'in_progress';
  this.startedAt = new Date();
  return this.save();
};

dailySessionSchema.methods.pause = async function() {
  this.status = 'paused';
  return this.save();
};

dailySessionSchema.methods.resume = async function() {
  this.status = 'in_progress';
  return this.save();
};

dailySessionSchema.methods.complete = async function() {
  this.status = 'completed';
  this.completedAt = new Date();

  // Calculate total time
  if (this.startedAt) {
    this.totalTimeSeconds = Math.floor((new Date().getTime() - this.startedAt.getTime()) / 1000);
  }

  return this.save();
};

dailySessionSchema.methods.skip = async function() {
  this.status = 'skipped';
  this.completedAt = new Date();
  return this.save();
};

dailySessionSchema.methods.addSection = async function(section: Omit<ISessionSection, '_id'>) {
  const sectionObj = new mongoose.Types.Subdocument(section);
  (sectionObj as any)._id = new mongoose.Types.ObjectId();

  this.sections.push(sectionObj);
  this.totalQuestions += section.totalQuestions;

  await this.save();
  return sectionObj._id;
};

dailySessionSchema.methods.updateSectionProgress = async function(
  sectionId: mongoose.Types.ObjectId,
  completedQuestions: number,
  status: 'pending' | 'in_progress' | 'completed'
) {
  const section = this.sections.id(sectionId);
  if (section) {
    section.completedQuestions = completedQuestions;
    section.status = status;
    await this.save();
  }
  return this;
};

dailySessionSchema.methods.recordQuestionAnswer = async function(
  questionId: mongoose.Types.ObjectId,
  answer: string,
  answerTimeSeconds: number,
  score: number
) {
  // Find the section containing this question
  for (const section of this.sections) {
    const question = section.questions.id(questionId);
    if (question) {
      question.status = 'answered';
      question.answer = answer;
      question.answerTimeSeconds = answerTimeSeconds;
      question.answerSubmittedAt = new Date();
      question.finalScore = score;

      // Update section progress
      section.completedQuestions += 1;
      if (score >= 0.7) {
        section.status = 'completed';
      }

      // Update session totals
      this.completedQuestions += 1;
      this.correctQuestions += score >= 0.7 ? 1 : 0;

      // Recalculate average score
      const allQuestionsInSession = await mongoose.model('SessionQuestion')
        .find({ sessionId: this._id });
      const totalScore = allQuestionsInSession.reduce((sum, q) => sum + (q.finalScore || 0), 0);
      this.averageScore = allQuestionsInSession.length > 0
        ? totalScore / allQuestionsInSession.length
        : 0;

      await this.save();
      break;
    }
  }

  return this;
};

// Static methods
dailySessionSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId, isDeleted: false })
    .sort({ sessionDate: -1 })
    .lean();
};

dailySessionSchema.statics.findByUserIdAndDate = function(
  userId: mongoose.Types.ObjectId,
  sessionDate: Date
) {
  return this.findOne({ userId, sessionDate, isDeleted: false });
};

dailySessionSchema.statics.findOrCreate = async function(
  userId: mongoose.Types.ObjectId,
  sessionDate: Date,
  userDayNumber: number
) {
  const existing = await this.findOne({ userId, sessionDate, isDeleted: false });

  if (existing) {
    return { session: existing, created: false };
  }

  const session = await this.create({
    userId,
    sessionDate,
    userDayNumber,
    status: 'pending',
  });

  return { session, created: true };
};

dailySessionSchema.statics.findRecentSessions = function(
  userId: mongoose.Types.ObjectId,
  limit: number = 10
) {
  return this.find({ userId, isDeleted: false })
    .sort({ sessionDate: -1 })
    .limit(limit);
};

dailySessionSchema.statics.getSessionsInRange = function(
  userId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  return this.find({
    userId,
    sessionDate: { $gte: startDate, $lte: endDate },
    isDeleted: false,
  })
    .sort({ sessionDate: -1 });
};

dailySessionSchema.statics.getStreak = async function(userId: mongoose.Types.ObjectId) {
  // Get completed sessions ordered by date
  const sessions = await this.find({
    userId,
    status: 'completed',
    isDeleted: false,
  })
    .sort({ sessionDate: -1 })
    .select('sessionDate')
    .lean();

  if (sessions.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sessions.length; i++) {
    const sessionDate = new Date(sessions[i].sessionDate);
    sessionDate.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);

    if (sessionDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};

// Create model for SessionQuestion separately for easier querying
const SessionQuestion: Model<any> = mongoose.model<ISessionQuestion>('SessionQuestion', sessionQuestionSchema as any);

// Create model
const DailySession: Model<IDailySessionDocument> = mongoose.model<IDailySessionDocument>('DailySession', dailySessionSchema as any);

export { DailySession, SessionQuestion };
export default DailySession;
