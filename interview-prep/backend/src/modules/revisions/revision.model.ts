import mongoose, { Schema, Document, Model } from 'mongoose';

// Revision status
export type RevisionStatus = 'pending' | 'due' | 'in_progress' | 'completed' | 'failed' | 'skipped';

// Revision performance
export type RevisionPerformance = 'excellent' | 'good' | 'average' | 'poor' | 'very_poor';

// Revision
export interface IRevision {
  _id: mongoose.Types.ObjectId;

  // User reference
  userId: mongoose.Types.ObjectId;

  // Original question reference
  questionHistoryId: mongoose.Types.ObjectId;
  originalQuestionId: mongoose.Types.ObjectId;
  originalQuestionSnapshot: {
    question: string;
    topic: string;
    subtopic: string;
    concepts: string[];
    difficulty: string;
    questionType: string;
    archetype: string;
    interviewPriority: string;
  };

  // Original answer (for reference)
  originalAnswer?: string;
  originalAnswerDate?: Date;
  originalScore?: number;

  // Revision metadata
  revisionNumber: number;
  revisionSchedule: {
    firstRevision: Date;  // Day +1
    secondRevision: Date; // Day +7
    thirdRevision: Date;  // Day +30
  };

  // Current revision state
  status: RevisionStatus;
  currentRevisionNumber: number;
  dueDate: Date;
  nextRevisionDate?: Date;

  // Current revision answer
  currentAnswer?: string;
  currentAnswerTimeSeconds?: number;
  currentAnswerSubmittedAt?: Date;

  // Current revision evaluation
  currentEvaluation?: {
    overallScore: number;
    improved: boolean;
    delta: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    missingPoints: string[];
    improvementSuggestions: string[];
    keyConceptsToRevise: string[];
    previousWeaknessesAddressed: string[];
    newWeaknesses: string[];
  };

  // Performance tracking
  currentScore?: number;
  performance: RevisionPerformance;
  isMastered: boolean;
  masteryProgress: number;

  // Revision history
  revisionAttempts: Array<{
    revisionNumber: number;
    answeredAt: Date;
    score: number;
    timeSeconds: number;
    evaluation: any;
    isCorrect: boolean;
  }>;

  // Flags
  isSkipped: boolean;
  skippedAt?: Date;
  isHidden: boolean;
  flaggedReason?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IRevisionDocument extends IRevision, Document {}

// Revision Schema
const revisionSchema = new Schema<IRevision>(
  {
    // User reference
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Original question reference
    questionHistoryId: {
      type: Schema.Types.ObjectId,
      ref: 'QuestionHistory',
      required: true,
      index: true,
    },
    originalQuestionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    originalQuestionSnapshot: {
      question: { type: String, required: true },
      topic: { type: String, required: true },
      subtopic: { type: String, required: true },
      concepts: [String],
      difficulty: String,
      questionType: String,
      archetype: String,
      interviewPriority: String,
    },

    // Original answer (for reference)
    originalAnswer: String,
    originalAnswerDate: Date,
    originalScore: Number,

    // Revision metadata
    revisionNumber: {
      type: Number,
      required: true,
      index: true,
    },
    revisionSchedule: {
      firstRevision: { type: Date, required: true },
      secondRevision: { type: Date, required: true },
      thirdRevision: { type: Date, required: true },
    },

    // Current revision state
    status: {
      type: String,
      enum: ['pending', 'due', 'in_progress', 'completed', 'failed', 'skipped'],
      default: 'pending',
      index: true,
    },
    currentRevisionNumber: {
      type: Number,
      default: 0,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    nextRevisionDate: Date,

    // Current revision answer
    currentAnswer: String,
    currentAnswerTimeSeconds: Number,
    currentAnswerSubmittedAt: Date,

    // Current revision evaluation
    currentEvaluation: {
      overallScore: Number,
      improved: Boolean,
      delta: Number,
      summary: String,
      strengths: [String],
      weaknesses: [String],
      missingPoints: [String],
      improvementSuggestions: [String],
      keyConceptsToRevise: [String],
      previousWeaknessesAddressed: [String],
      newWeaknesses: [String],
    },

    // Performance tracking
    currentScore: Number,
    performance: {
      type: String,
      enum: ['excellent', 'good', 'average', 'poor', 'very_poor'],
    },
    isMastered: { type: Boolean, default: false },
    masteryProgress: { type: Number, default: 0 },

    // Revision history
    revisionAttempts: [{
      revisionNumber: Number,
      answeredAt: Date,
      score: Number,
      timeSeconds: Number,
      evaluation: Schema.Types.Mixed,
      isCorrect: Boolean,
    }],

    // Flags
    isSkipped: { type: Boolean, default: false },
    skippedAt: Date,
    isHidden: { type: Boolean, default: false },
    flaggedReason: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
revisionSchema.index({ userId: 1, status: 1 }, { name: 'user_status_index' });
revisionSchema.index({ userId: 1, dueDate: 1 }, { name: 'user_due_date_index' });
revisionSchema.index({ userId: 1, revisionNumber: 1 });
revisionSchema.index({ userId: 1, nextRevisionDate: 1 });
revisionSchema.index({ userId: 1, isMastered: 1 });
revisionSchema.index({ userId: 1, topic: 1 }, { partialFilterExpression: { topic: { $exists: true } } });
revisionSchema.index({ questionHistoryId: 1 }, { unique: true, name: 'unique_question_history' });

// Methods
revisionSchema.methods.start = async function() {
  this.status = 'in_progress';
  return this.save();
};

revisionSchema.methods.complete = async function(
  answer: string,
  answerTimeSeconds: number,
  evaluation: NonNullable<IRevision['currentEvaluation']>
) {
  this.status = 'completed';
  this.currentAnswer = answer;
  this.currentAnswerTimeSeconds = answerTimeSeconds;
  this.currentAnswerSubmittedAt = new Date();

  // Record attempt
  this.revisionAttempts.push({
    revisionNumber: this.currentRevisionNumber,
    answeredAt: new Date(),
    score: evaluation.overallScore,
    timeSeconds: answerTimeSeconds,
    evaluation: evaluation,
    isCorrect: evaluation.overallScore >= 0.7,
  });

  // Update performance
  this.currentScore = evaluation.overallScore;
  this.currentEvaluation = evaluation;

  // Determine performance level
  if (evaluation.overallScore >= 0.9) {
    this.performance = 'excellent';
  } else if (evaluation.overallScore >= 0.7) {
    this.performance = 'good';
  } else if (evaluation.overallScore >= 0.5) {
    this.performance = 'average';
  } else if (evaluation.overallScore >= 0.3) {
    this.performance = 'poor';
  } else {
    this.performance = 'very_poor';
  }

  // Update mastery progress
  this.masteryProgress = calculateMasteryProgress(
    this.masteryProgress,
    evaluation.overallScore,
    this.revisionNumber
  );

  // Check if mastered
  if (this.masteryProgress >= 0.8 && this.currentRevisionNumber >= 3) {
    this.isMastered = true;
    this.status = 'completed';
  }

  // Calculate next revision date
  this.nextRevisionDate = calculateNextRevisionDate(
    evaluation.overallScore,
    this.revisionNumber,
    this.dueDate
  );

  return this.save();
};

revisionSchema.methods.skip = async function() {
  this.status = 'skipped';
  this.isSkipped = true;
  this.skippedAt = new Date();
  return this.save();
};

revisionSchema.methods.markFailed = async function() {
  this.status = 'failed';
  this.currentScore = 0;
  this.performance = 'very_poor';

  // Add failed attempt
  this.revisionAttempts.push({
    revisionNumber: this.currentRevisionNumber,
    answeredAt: new Date(),
    score: 0,
    timeSeconds: this.currentAnswerTimeSeconds || 0,
    evaluation: { overallScore: 0 },
    isCorrect: false,
  });

  return this.save();
};

// Calculate mastery progress
function calculateMasteryProgress(currentProgress: number, score: number, revisionNumber: number): number {
  const learningRate = 0.15;

  // Increase for correct answers, decrease for incorrect
  if (score >= 0.7) {
    return Math.min(1, currentProgress + learningRate * score * (1 + revisionNumber * 0.1));
  } else {
    return Math.max(0, currentProgress - learningRate * (1 - score));
  }
}

// Calculate next revision date based on spaced repetition
function calculateNextRevisionDate(score: number, revisionNumber: number, currentDate: Date): Date {
  let intervalDays: number;

  if (score >= 0.9) {
    // Excellent - longer interval
    intervalDays = revisionNumber === 1 ? 7 : revisionNumber === 2 ? 14 : 30;
  } else if (score >= 0.7) {
    // Good - normal interval
    intervalDays = revisionNumber === 1 ? 7 : revisionNumber === 2 ? 10 : 21;
  } else if (score >= 0.5) {
    // Average - shorter interval
    intervalDays = revisionNumber === 1 ? 3 : revisionNumber === 2 ? 7 : 14;
  } else {
    // Poor - very short interval
    intervalDays = revisionNumber === 1 ? 1 : revisionNumber === 2 ? 3 : 7;
  }

  // Cap revision number at 3 schedule entries
  if (revisionNumber >= 3) {
    intervalDays = Math.max(intervalDays, 30);
  }

  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + intervalDays);
  return nextDate;
}

// Static methods
revisionSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId }).sort({ dueDate: 1 });
};

revisionSchema.statics.findDueRevisions = function(
  userId: mongoose.Types.ObjectId,
  includePastDue: boolean = true
) {
  const now = new Date();
  const filter: any = {
    userId,
    status: { $in: ['pending', 'due'] },
    dueDate: includePastDue ? { $lte: now } : { $lte: now, $gte: now },
  };

  return this.find(filter).sort({ dueDate: 1 });
};

revisionSchema.statics.countDueRevisions = function(userId: mongoose.Types.ObjectId) {
  const now = new Date();
  return this.countDocuments({
    userId,
    status: { $in: ['pending', 'due'] },
    dueDate: { $lte: now },
  });
};

revisionSchema.statics.findByQuestionHistoryId = function(questionHistoryId: mongoose.Types.ObjectId) {
  return this.findOne({ questionHistoryId });
};

/**
 * Find an active (non-completed/failed/skipped) revision for a question
 * history entry. Used to avoid duplicate revisions when the same question
 * is answered poorly more than once (unique index on questionHistoryId).
 */
revisionSchema.statics.findActiveByQuestionHistoryId = function(
  questionHistoryId: mongoose.Types.ObjectId
) {
  return this.findOne({
    questionHistoryId,
    status: { $in: ['pending', 'due', 'in_progress'] },
  });
};

revisionSchema.statics.createRevision = async function(
  userId: mongoose.Types.ObjectId,
  questionHistory: any,
  originalQuestion: any
): Promise<IRevision> {
  const now = new Date();

  // Calculate revision schedule (Day +1, Day +7, Day +30)
  const revisionSchedule = {
    firstRevision: new Date(now.getTime() + 24 * 60 * 60 * 1000),  // +1 day
    secondRevision: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),  // +7 days
    thirdRevision: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),  // +30 days
  };

  const revision = new this({
    userId,
    questionHistoryId: questionHistory._id,
    originalQuestionId: originalQuestion._id,
    originalQuestionSnapshot: {
      question: questionHistory.questionSnapshot.question,
      topic: questionHistory.questionSnapshot.topic,
      subtopic: questionHistory.questionSnapshot.subtopic,
      concepts: questionHistory.questionSnapshot.concepts,
      difficulty: questionHistory.questionSnapshot.difficulty,
      questionType: questionHistory.questionSnapshot.questionType,
      archetype: originalQuestion.archetype,
      interviewPriority: originalQuestion.interviewPriority,
    },
    originalAnswer: questionHistory.answer,
    originalAnswerDate: questionHistory.answerSubmittedAt,
    originalScore: questionHistory.finalScore,
    revisionNumber: 1,
    revisionSchedule,
    status: 'pending',
    dueDate: revisionSchedule.firstRevision,
    currentRevisionNumber: 0,
    revisionAttempts: [],
    masteryProgress: originalQuestion.difficulty === 'EASY' ? 0.3 : 0,
  });

  return revision.save();
};

revisionSchema.statics.getRevisionScheduleStats = function(userId: mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        averageMastery: { $avg: '$masteryProgress' },
        totalAttempts: { $sum: { $size: '$revisionAttempts' } },
      },
    },
  ]);
};

revisionSchema.statics.getWeakAreasNeedingRevision = function(userId: mongoose.Types.ObjectId, limit: number = 10) {
  return this.find({
    userId,
    status: { $in: ['pending', 'due', 'failed'] },
    dueDate: { $lte: new Date() },
    masteryProgress: { $lt: 0.5 },
  })
    .sort({ masteryProgress: 1, dueDate: 1 })
    .limit(limit);
};

// Create model
const Revision: Model<IRevisionDocument> = mongoose.model<IRevisionDocument>('Revision', revisionSchema as any);

export { Revision };
export default Revision;
