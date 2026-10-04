import mongoose, { Schema, Document, Model } from 'mongoose';
import { Difficulty, QuestionType, Provenance, AnswerDepth } from './question.model';

// Question status
export type QuestionStatus =
  | 'NEW'
  | 'ANSWERED'
  | 'SKIPPED'
  | 'BOOKMARKED'
  | 'FLAG_FOR_REVIEW'
  | 'REVISION'
  | 'MOCK'
  | 'PROJECT_INTERVIEW';

// Question history entry
export interface IQuestionHistory {
  _id: mongoose.Types.ObjectId;

  // User reference
  userId: mongoose.Types.ObjectId;

  // Question reference
  questionId: mongoose.Types.ObjectId;
  questionVersion: number;

  /** Resume profile active when this question was served (topic practice). */
  resumeProfileId?: mongoose.Types.ObjectId;
  /** True when the row came from topic-wise practice rather than a daily session. */
  isTopicPractice?: boolean;

  // Session context
  sessionId?: mongoose.Types.ObjectId;
  sessionDate?: Date;
  isRevision: boolean;
  revisionNumber?: number;
  isMock: boolean;
  isProjectInterview: boolean;
  isSystemDesign: boolean;
  isCoding: boolean;

  // Question details (snapshot at time of exposure)
  questionSnapshot: {
    question: string;
    topic: string;
    subtopic: string;
    concepts: string[];
    difficulty: Difficulty;
    questionType: QuestionType;
    archetype: string;
    interviewPriority: string;
    resumeRelevance: string;
    expectedAnswerDepth: AnswerDepth;
    estimatedAnswerTimeSeconds: number;
    provenance: Provenance;
    practiceSource?: { kind: 'project' | 'experience'; id: string; label: string };
  };

  // Answer
  answer?: string;
  answerTimeSeconds?: number;
  answerSubmittedAt?: Date;

  // Evaluation (from AI)
  evaluation?: {
    overallScore: number;
    technicalCorrectness: number;
    completeness: number;
    depth: number;
    clarity: number;
    internalUnderstanding: number;
    productionThinking: number;
    tradeOffAwareness: number;
    scalabilityReasoning: number;
    reliabilityReasoning: number;
    securityAwareness: number;
    communicationQuality: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    missingPoints: string[];
    followUpSuggestions: string[];
    improvementSuggestions: string[];
    keyConceptsToRevise: string[];
    strongerAnswerStructure?: string;
    technicalGaps?: string[];
  };

  // Status and metadata
  status: QuestionStatus;
  bookmarked: boolean;
  flagged: boolean;
  userNotes?: string;
  difficultyFeedback?: 'too_easy' | 'too_hard' | 'just_right' | 'already_knew' | 'duplicate' | 'not_relevant' | 'incorrect';
  feedback?: string;
  feedbackNotes?: string;

  // Scoring
  selfAssessedScore?: number;
  aiAssessedScore?: number;
  finalScore?: number;

  // Concept tracking
  conceptsTested: string[];
  conceptsMastered: string[];
  conceptsWeak: string[];
  conceptsNeedRevision: string[];

  // Weakness detection
  detectedWeaknesses?: string[];
  detectedKnowledgeGaps?: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuestionHistoryDocument extends IQuestionHistory, Document {}

// Question History Schema
const questionHistorySchema = new Schema<IQuestionHistory>(
  {
    // User reference
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Question reference
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    questionVersion: {
      type: Number,
      default: 1,
    },

    // Resume profile + origin tagging
    resumeProfileId: { type: Schema.Types.ObjectId, ref: 'ResumeProfile', index: true },
    isTopicPractice: { type: Boolean, default: false, index: true },

    // Session context
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'DailySession',
    },
    sessionDate: Date,
    isRevision: {
      type: Boolean,
      default: false,
    },
    revisionNumber: Number,
    isMock: { type: Boolean, default: false },
    isProjectInterview: { type: Boolean, default: false },
    isSystemDesign: { type: Boolean, default: false },
    isCoding: { type: Boolean, default: false },

    // Question snapshot (denormalized for history)
    questionSnapshot: {
      practiceSource: { kind: String, id: String, label: String },
      question: { type: String, required: true },
      topic: { type: String, required: true },
      subtopic: { type: String, required: true },
      concepts: [String],
      difficulty: {
        type: String,
        enum: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'],
        required: true,
      },
      questionType: {
        type: String,
        enum: [
          'FOUNDATIONAL', 'CONCEPTUAL', 'INTERNAL_WORKING', 'IMPLEMENTATION',
          'CODE_REASONING', 'DEBUGGING', 'PRODUCTION_SCENARIO', 'PERFORMANCE',
          'CONCURRENCY', 'SECURITY', 'FAILURE_SCENARIO', 'DESIGN', 'TRADE_OFF',
          'WHY', 'WHY_NOT', 'WHAT_HAPPENS_IF', 'MIGRATION', 'SCALABILITY',
          'OBSERVABILITY', 'INCIDENT_RESPONSE', 'ARCHITECTURE', 'RESUME_PROJECT',
          'SYSTEM_DESIGN', 'CODING'
        ],
        required: true,
      },
      archetype: String,
      interviewPriority: String,
      resumeRelevance: String,
      expectedAnswerDepth: {
        type: String,
        enum: ['SHORT', 'MODERATE', 'DEEP'],
        default: 'MODERATE',
      },
      estimatedAnswerTimeSeconds: Number,
      provenance: {
        type: String,
        enum: ['CURATED', 'AI_GENERATED', 'RESUME_DERIVED', 'MARKET_CALIBRATED', 'USER_CREATED'],
        required: true,
      },
    },

    // Answer
    answer: String,
    answerTimeSeconds: Number,
    answerSubmittedAt: Date,

    // Evaluation
    evaluation: {
      overallScore: Number,
      technicalCorrectness: Number,
      completeness: Number,
      depth: Number,
      clarity: Number,
      internalUnderstanding: Number,
      productionThinking: Number,
      tradeOffAwareness: Number,
      scalabilityReasoning: Number,
      reliabilityReasoning: Number,
      securityAwareness: Number,
      communicationQuality: Number,
      summary: String,
      strengths: [String],
      weaknesses: [String],
      missingPoints: [String],
      followUpSuggestions: [String],
      improvementSuggestions: [String],
      keyConceptsToRevise: [String],
      strongerAnswerStructure: String,
      technicalGaps: [String],
    },

    // Status and metadata
    status: {
      type: String,
      enum: ['NEW', 'ANSWERED', 'SKIPPED', 'BOOKMARKED', 'FLAG_FOR_REVIEW', 'REVISION', 'MOCK', 'PROJECT_INTERVIEW'],
      default: 'NEW',
      index: true,
    },
    bookmarked: { type: Boolean, default: false },
    flagged: { type: Boolean, default: false },
    userNotes: String,
    difficultyFeedback: {
      type: String,
      enum: ['too_easy', 'too_hard', 'just_right', 'already_knew', 'duplicate', 'not_relevant', 'incorrect'],
    },
    feedback: String,
    feedbackNotes: String,

    // Scoring
    selfAssessedScore: Number,
    aiAssessedScore: Number,
    finalScore: Number,

    // Concept tracking
    conceptsTested: [String],
    conceptsMastered: [String],
    conceptsWeak: [String],
    conceptsNeedRevision: [String],

    // Weakness detection
    detectedWeaknesses: [String],
    detectedKnowledgeGaps: [String],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
questionHistorySchema.index({ userId: 1, status: 1 });
questionHistorySchema.index({ userId: 1, createdAt: -1 });
questionHistorySchema.index({ userId: 1, sessionId: 1 });
questionHistorySchema.index({ userId: 1, questionId: 1 }, { unique: true });
questionHistorySchema.index({ userId: 1, 'questionSnapshot.topic': 1 });
questionHistorySchema.index({ userId: 1, 'questionSnapshot.subtopic': 1 });
questionHistorySchema.index({ userId: 1, isRevision: 1, revisionNumber: 1 });
questionHistorySchema.index({ userId: 1, sessionDate: 1 });
questionHistorySchema.index({ userId: 1, 'questionSnapshot.difficulty': 1 });
questionHistorySchema.index({ userId: 1, 'questionSnapshot.questionType': 1 });
questionHistorySchema.index({ userId: 1, status: 1, createdAt: -1 });

// Text index for search
questionHistorySchema.index(
  { answer: 'text', userNotes: 'text', evaluation: 'text' },
  { default_language: 'english' }
);

// Methods
questionHistorySchema.methods.markAnswered = async function(answer: string, answerTimeSeconds: number) {
  this.status = 'ANSWERED';
  this.answer = answer;
  this.answerTimeSeconds = answerTimeSeconds;
  this.answerSubmittedAt = new Date();
  return this.save();
};

questionHistorySchema.methods.markBookmarked = async function() {
  this.bookmarked = true;
  this.status = 'BOOKMARKED';
  return this.save();
};

questionHistorySchema.methods.unmarkBookmarked = async function() {
  this.bookmarked = false;
  if (this.status === 'BOOKMARKED') {
    this.status = 'NEW';
  }
  return this.save();
};

questionHistorySchema.methods.addEvaluation = async function(evaluation: NonNullable<IQuestionHistory['evaluation']>) {
  this.evaluation = evaluation;
  this.aiAssessedScore = evaluation.overallScore;
  this.finalScore = evaluation.overallScore;
  return this.save();
};

questionHistorySchema.methods.updateConceptTracking = async function(
  tested: string[],
  mastered: string[],
  weak: string[],
  needRevision: string[]
) {
  this.conceptsTested = [...new Set([...this.conceptsTested, ...tested])];
  this.conceptsMastered = [...new Set([...this.conceptsMastered, ...mastered])];
  this.conceptsWeak = [...new Set([...this.conceptsWeak, ...weak])];
  this.conceptsNeedRevision = [...new Set([...this.conceptsNeedRevision, ...needRevision])];
  return this.save();
};

questionHistorySchema.methods.recordWeaknesses = async function(weaknesses: string[], gaps: string[]) {
  this.detectedWeaknesses = [...new Set([...this.detectedWeaknesses || [], ...weaknesses])];
  this.detectedKnowledgeGaps = [...new Set([...this.detectedKnowledgeGaps || [], ...gaps])];
  return this.save();
};

// Static methods
questionHistorySchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

questionHistorySchema.statics.findBySessionId = function(sessionId: mongoose.Types.ObjectId) {
  return this.find({ sessionId }).sort({ createdAt: 1 });
};

questionHistorySchema.statics.findByQuestionId = function(questionId: mongoose.Types.ObjectId) {
  return this.find({ questionId }).sort({ createdAt: -1 });
};

questionHistorySchema.statics.findByUserIdAndQuestionId = function(
  userId: mongoose.Types.ObjectId,
  questionId: mongoose.Types.ObjectId
) {
  return this.findOne({ userId, questionId });
};

questionHistorySchema.statics.findUserQuestionHistory = function(
  userId: mongoose.Types.ObjectId,
  options: {
    topic?: string;
    subtopic?: string;
    difficulty?: string;
    questionType?: string;
    status?: string;
    isRevision?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) {
  const filter: any = { userId };

  if (options.topic) {
    filter['questionSnapshot.topic'] = options.topic;
  }
  if (options.subtopic) {
    filter['questionSnapshot.subtopic'] = options.subtopic;
  }
  if (options.difficulty) {
    filter['questionSnapshot.difficulty'] = options.difficulty;
  }
  if (options.questionType) {
    filter['questionSnapshot.questionType'] = options.questionType;
  }
  if (options.status) {
    filter.status = options.status;
  }
  if (options.isRevision !== undefined) {
    filter.isRevision = options.isRevision;
  }

  return this.find(filter)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.offset || 0);
};

questionHistorySchema.statics.countByStatus = function(userId: mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
};

questionHistorySchema.statics.getTopicProgress = function(
  userId: mongoose.Types.ObjectId,
  topic: string
) {
  return this.aggregate([
    { $match: { userId, 'questionSnapshot.topic': topic } },
    {
      $group: {
        _id: '$questionSnapshot.subtopic',
        totalQuestions: { $sum: 1 },
        answeredQuestions: {
          $sum: { $cond: [{ $eq: ['$status', 'ANSWERED'] }, 1, 0] },
        },
        averageScore: { $avg: '$finalScore' },
        latestDate: { $max: '$createdAt' },
      },
    },
    { $sort: { totalQuestions: -1 } },
  ]);
};

// Create model
const QuestionHistory: Model<IQuestionHistoryDocument> = mongoose.model<IQuestionHistoryDocument>('QuestionHistory', questionHistorySchema as any);

export { QuestionHistory };
export default QuestionHistory;
