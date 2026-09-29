import mongoose, { Schema, Document, Model } from 'mongoose';

// Interview type
export type InterviewType =
  | 'technical'
  | 'backend'
  | 'java'
  | 'nodejs'
  | 'system_design'
  | 'project_deep_dive'
  | 'full_sde2'
  | 'behavioral'
  | 'leadership'
  | 'custom';

// Interview status
export type InterviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'abandoned' | 'cancelled';

// Mock interview
export interface IMockInterview {
  turnInProgress?: boolean;
  turnStartedAt?: Date;
  _id: mongoose.Types.ObjectId;

  // User reference
  userId: mongoose.Types.ObjectId;

  // Interview configuration
  type: InterviewType;
  title?: string;
  description?: string;

  // Focus areas
  focusTopics: string[];
  focusSkills: string[];
  excludedTopics: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  duration: number; // minutes

  // Interviewer personality
  interviewerStyle?: 'friendly' | 'neutral' | 'challenging' | 'socratic';
  interviewerName?: string;

  // Questions asked
  questions: Array<{
    questionId: mongoose.Types.ObjectId;
    questionSnapshot: {
      question: string;
      topic: string;
      subtopic: string;
      concepts: string[];
      difficulty: string;
      questionType: string;
      archetype: string;
      isSystemDesign: boolean;
      isCoding: boolean;
      isProjectInterview: boolean;
    };
    order: number;
    status: 'pending' | 'asked' | 'answered' | 'skipped';
    askedAt?: Date;
    response?: string;
    responseTimeSeconds?: number;
    evaluation?: any;
    followUpQuestions?: Array<{
      question: string;
      askedAt: Date;
      response?: string;
      responseTimeSeconds?: number;
      evaluation?: any;
    }>;
    isFollowUp: boolean;
    parentQuestionIndex?: number;
  }>;

  // Interview metadata
  status: InterviewStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationSeconds?: number;

  // Results
  totalQuestions: number;
  answeredQuestions: number;
  averageScore: number;
  weakAreas: string[];
  strongAreas: string[];
  overallFeedback?: string;
  summary?: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    areasToImprove: string[];
    interviewPerformance: string;
  };

  // User feedback
  userRating?: number; // 1-5
  userFeedback?: string;

  // Flags
  isDeleted: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IMockInterviewDocument extends IMockInterview, Document {}

// Mock Interview Schema
const mockInterviewSchema = new Schema<IMockInterview>(
  {
    // User reference
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    turnInProgress: { type: Boolean, default: false },
    turnStartedAt: Date,
    // Interview configuration
    type: {
      type: String,
      enum: [
        'technical', 'backend', 'java', 'nodejs', 'system_design',
        'project_deep_dive', 'full_sde2', 'behavioral', 'leadership', 'custom'
      ],
      required: true,
      index: true,
    },
    title: String,
    description: String,

    // Focus areas
    focusTopics: [String],
    focusSkills: [String],
    excludedTopics: [String],
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'mixed'],
      default: 'mixed',
    },
    duration: { type: Number, default: 45 },

    // Interviewer style
    interviewerStyle: {
      type: String,
      enum: ['friendly', 'neutral', 'challenging', 'socratic'],
      default: 'neutral',
    },
    interviewerName: String,

    // Questions asked (embedded array)
    questions: [{
      questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
      questionSnapshot: {
        question: String,
        topic: String,
        subtopic: String,
        concepts: [String],
        difficulty: String,
        questionType: String,
        archetype: String,
        isSystemDesign: Boolean,
        isCoding: Boolean,
        isProjectInterview: Boolean,
      },
      order: Number,
      status: {
        type: String,
        enum: ['pending', 'asked', 'answered', 'skipped'],
        default: 'pending',
      },
      askedAt: Date,
      response: String,
      responseTimeSeconds: Number,
      evaluation: Schema.Types.Mixed,
      followUpQuestions: [{
        question: String,
        askedAt: Date,
        response: String,
        responseTimeSeconds: Number,
        evaluation: Schema.Types.Mixed,
      }],
      isFollowUp: { type: Boolean, default: false },
      parentQuestionIndex: Number,
    }],

    // Interview metadata
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'abandoned', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    startedAt: Date,
    completedAt: Date,
    durationSeconds: Number,

    // Results
    totalQuestions: { type: Number, default: 0 },
    answeredQuestions: { type: Number, default: 0 },
    averageScore: Number,
    weakAreas: [String],
    strongAreas: [String],
    overallFeedback: String,
    summary: {
      strengths: [String],
      weaknesses: [String],
      recommendations: [String],
      areasToImprove: [String],
      interviewPerformance: String,
    },

    // User feedback
    userRating: Number,
    userFeedback: String,

    // Flags
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
mockInterviewSchema.index({ userId: 1, status: 1 });
mockInterviewSchema.index({ userId: 1, type: 1 });
mockInterviewSchema.index({ userId: 1, startedAt: -1 });
mockInterviewSchema.index({ userId: 1, completedAt: -1 });
mockInterviewSchema.index({ userId: 1, isDeleted: 1 });

// Methods
mockInterviewSchema.methods.start = async function() {
  this.status = 'in_progress';
  this.startedAt = new Date();
  this.questions.forEach((q, index) => {
    if (q.status === 'pending') {
      q.status = 'asked';
      q.askedAt = new Date();
    }
  });
  return this.save();
};

mockInterviewSchema.methods.addQuestion = async function(
  questionId: mongoose.Types.ObjectId,
  questionSnapshot: any,
  order: number
) {
  this.questions.push({
    questionId,
    questionSnapshot,
    order,
    status: 'pending',
  });
  this.totalQuestions += 1;
  return this.save();
};

mockInterviewSchema.methods.recordAnswer = async function(
  questionIndex: number,
  response: string,
  responseTimeSeconds: number,
  evaluation: any
) {
  if (this.questions[questionIndex]) {
    const question = this.questions[questionIndex];
    question.status = 'answered';
    question.response = response;
    question.responseTimeSeconds = responseTimeSeconds;
    question.evaluation = evaluation;

    this.answeredQuestions += 1;

    // Update average score
    const answeredQs = this.questions.filter(q => q.status === 'answered' && q.evaluation?.overallScore);
    if (answeredQs.length > 0) {
      const totalScore = answeredQs.reduce((sum, q) => sum + (q.evaluation?.overallScore || 0), 0);
      this.averageScore = totalScore / answeredQs.length;
    }

    await this.save();
  }
  return this;
};

mockInterviewSchema.methods.addFollowUp = async function(
  questionIndex: number,
  followUp: {
    question: string;
    evaluation?: any;
    response?: string;
    responseTimeSeconds?: number;
  }
) {
  if (this.questions[questionIndex]) {
    this.questions[questionIndex].followUpQuestions.push({
      question: followUp.question,
      askedAt: new Date(),
      evaluation: followUp.evaluation,
      response: followUp.response,
      responseTimeSeconds: followUp.responseTimeSeconds,
    });

    // Update average score to include follow-up
    const allEvaluations = this.questions
      .flatMap(q => [q.evaluation, ...q.followUpQuestions.map(f => f.evaluation)])
      .filter((e: any) => e?.overallScore);

    if (allEvaluations.length > 0) {
      const totalScore = allEvaluations.reduce((sum, e) => sum + (e.overallScore || 0), 0);
      this.averageScore = totalScore / allEvaluations.length;
    }

    await this.save();
  }
  return this;
};

mockInterviewSchema.methods.complete = async function(
  overallFeedback: string,
  summary: IMockInterview['summary']
) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.durationSeconds = this.startedAt
    ? Math.floor((new Date().getTime() - this.startedAt.getTime()) / 1000)
    : undefined;
  this.overallFeedback = overallFeedback;
  this.summary = summary;

  // Extract weak and strong areas from summary
  if (summary) {
    this.weakAreas = summary.weaknesses || [];
    this.strongAreas = summary.strengths || [];
  }

  return this.save();
};

mockInterviewSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  this.completedAt = new Date();
  return this.save();
};

mockInterviewSchema.methods.abandon = async function() {
  this.status = 'abandoned';
  this.completedAt = new Date();
  this.durationSeconds = this.startedAt
    ? Math.floor((new Date().getTime() - this.startedAt.getTime()) / 1000)
    : undefined;
  return this.save();
};

// Static methods
mockInterviewSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId, isDeleted: false })
    .sort({ createdAt: -1 });
};

mockInterviewSchema.statics.findByUserIdAndType = function(
  userId: mongoose.Types.ObjectId,
  type: InterviewType
) {
  return this.find({ userId, type, isDeleted: false })
    .sort({ createdAt: -1 });
};

mockInterviewSchema.statics.getInterviewStats = function(userId: mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { userId, isDeleted: false } },
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        averageScore: { $avg: '$averageScore' },
        averageDuration: { $avg: '$durationSeconds' },
      },
    },
    {
      $project: {
        _id: 0,
        type: '$_id',
        total: 1,
        completed: 1,
        completionRate: {
          $cond: [
            { $gt: ['$total', 0] },
            { $multiply: [{ $divide: ['$completed', '$total'] }, 100] },
            0,
          ],
        },
        averageScore: {
          $cond: [
            { $ne: ['$averageScore', null] },
            { $round: ['$averageScore', 2] },
            0,
          ],
        },
        averageDuration: {
          $cond: [
            { $ne: ['$averageDuration', null] },
            { $round: [{ $divide: ['$averageDuration', 60] }, 1] },
            0,
          ],
        },
      },
    },
    { $sort: { type: 1 } },
  ]);
};

mockInterviewSchema.statics.getRecentCompleted = function(
  userId: mongoose.Types.ObjectId,
  limit: number = 5
) {
  return this.find({
    userId,
    status: 'completed',
    isDeleted: false,
  })
    .sort({ completedAt: -1 })
    .limit(limit);
};

// Create model
const MockInterview: Model<IMockInterviewDocument> = mongoose.model<IMockInterviewDocument>('MockInterview', mockInterviewSchema as any);

export { MockInterview };
export default MockInterview;
