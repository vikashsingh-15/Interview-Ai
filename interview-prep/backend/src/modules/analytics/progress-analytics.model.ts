import mongoose, { Schema, Document, Model } from 'mongoose';

// Analytics period
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

// Summary type
export type SummaryType = 'overall' | 'by_topic' | 'by_difficulty' | 'by_question_type' | 'by_provenance' | 'by_session' | 'weekly_trend' | 'monthly_trend' | 'coding' | 'system_design' | 'project' | 'revision' | 'mock_interview';

// User Progress
export interface IUserProgress {
  _id: mongoose.Types.ObjectId;

  userId: mongoose.Types.ObjectId;

  // Overall stats
  totalQuestions: number;
  totalNewQuestions: number;
  totalRevisionQuestions: number;
  totalMockQuestions: number;
  totalProjectQuestions: number;
  totalSystemDesignQuestions: number;
  totalCodingQuestions: number;

  // Answered stats
  answeredQuestions: number;
  skippedQuestions: number;
  bookmarkedQuestions: number;
  flaggedQuestions: number;

  // Score stats
  averageScore: number;
  medianScore: number;
  bestScore: number;
  worstScore: number;
  scoreDistribution: {
    excellent: number; // >= 0.9
    good: number; // >= 0.7
    average: number; // >= 0.5
    poor: number; // >= 0.3
    very_poor: number; // < 0.3
  };

  // Time stats
  totalStudyTimeSeconds: number;
  averageAnswerTimeSeconds: number;
  longestSessionSeconds: number;
  shortestSessionSeconds: number;

  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: Date;
  daysActive: number;
  totalDays: number;
  completionRate: number;

  // Mastery stats
  masteredSkills: number;
  weakSkills: number;
  masteredConcepts: number;
  weakConcepts: number;
  masteredTopics: number;
  weakTopics: number;

  // Topic breakdown
  topicProgress: Array<{
    topic: string;
    questions: number;
    answered: number;
    averageScore: number;
    mastery: number;
    weak: boolean;
    mastered: boolean;
    lastStudied?: Date;
  }>;

  // Difficulty breakdown
  difficultyProgress: Array<{
    difficulty: string;
    questions: number;
    answered: number;
    averageScore: number;
  }>;

  // Question type breakdown
  questionTypeProgress: Array<{
    questionType: string;
    questions: number;
    answered: number;
    averageScore: number;
  }>;

  // Coding progress
  codingProgress: {
    totalProblems: number;
    solvedProblems: number;
    attemptedProblems: number;
    averageDifficulty: number; // 1=easy, 2=medium, 3=hard
    patternsProgress: Array<{
      pattern: string;
      total: number;
      solved: number;
      attempted: number;
      completionRate: number;
    }>;
    languagesUsed: Array<{
      language: string;
      problemsCount: number;
      solvedCount: number;
    }>;
  };

  // System design progress
  systemDesignProgress: {
    totalQuestions: number;
    answeredQuestions: number;
    averageScore: number;
    topAreas: Array<{
      area: string;
      questions: number;
      score: number;
    }>;
  };

  // Project interview progress
  projectProgress: {
    totalProjects: number;
    totalProjectQuestions: number;
    averageProjectScore: number;
    projectsWithInterviewPrep: number;
    topProjects: Array<{
      projectName: string;
      questionsAsked: number;
      averageScore: number;
    }>;
  };

  // Revision progress
  revisionProgress: {
    totalRevisions: number;
    dueRevisions: number;
    completedRevisions: number;
    abandonedRevisions: number;
    masteredRevisions: number;
    averageRevisionScore: number;
  };

  // Mock interview progress
  mockInterviewProgress: {
    totalInterviews: number;
    completedInterviews: number;
    averageScore: number;
    interviewTypes: Array<{
      type: string;
      total: number;
      completed: number;
      averageScore: number;
    }>;
  };

  // Period summaries
  dailySummaries: Array<{
    date: Date;
    questions: number;
    answered: number;
    averageScore: number;
    studyTimeSeconds: number;
    topics: string[];
  }>;

  // Summary metadata
  lastCalculatedAt: Date;
  calculationVersion: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProgressDocument extends IUserProgress, Document {}

// User Progress Schema
const userProgressSchema = new Schema<IUserProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Overall stats
    totalQuestions: { type: Number, default: 0 },
    totalNewQuestions: { type: Number, default: 0 },
    totalRevisionQuestions: { type: Number, default: 0 },
    totalMockQuestions: { type: Number, default: 0 },
    totalProjectQuestions: { type: Number, default: 0 },
    totalSystemDesignQuestions: { type: Number, default: 0 },
    totalCodingQuestions: { type: Number, default: 0 },

    // Answered stats
    answeredQuestions: { type: Number, default: 0 },
    skippedQuestions: { type: Number, default: 0 },
    bookmarkedQuestions: { type: Number, default: 0 },
    flaggedQuestions: { type: Number, default: 0 },

    // Score stats
    averageScore: { type: Number, default: 0 },
    medianScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    worstScore: { type: Number, default: 1 },
    scoreDistribution: {
      excellent: { type: Number, default: 0 },
      good: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      poor: { type: Number, default: 0 },
      very_poor: { type: Number, default: 0 },
    },

    // Time stats
    totalStudyTimeSeconds: { type: Number, default: 0 },
    averageAnswerTimeSeconds: { type: Number, default: 0 },
    longestSessionSeconds: { type: Number, default: 0 },
    shortestSessionSeconds: { type: Number, default: 0 },

    // Streaks
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: Date,
    daysActive: { type: Number, default: 0 },
    totalDays: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },

    // Mastery stats
    masteredSkills: { type: Number, default: 0 },
    weakSkills: { type: Number, default: 0 },
    masteredConcepts: { type: Number, default: 0 },
    weakConcepts: { type: Number, default: 0 },
    masteredTopics: { type: Number, default: 0 },
    weakTopics: { type: Number, default: 0 },

    // Topic breakdown
    topicProgress: [{
      topic: { type: String, required: true },
      questions: { type: Number, default: 0 },
      answered: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      mastery: { type: Number, default: 0 },
      weak: { type: Boolean, default: false },
      mastered: { type: Boolean, default: false },
      lastStudied: Date,
    }],

    // Difficulty breakdown
    difficultyProgress: [{
      difficulty: { type: String, required: true },
      questions: { type: Number, default: 0 },
      answered: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
    }],

    // Question type breakdown
    questionTypeProgress: [{
      questionType: { type: String, required: true },
      questions: { type: Number, default: 0 },
      answered: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
    }],

    // Coding progress
    codingProgress: {
      totalProblems: { type: Number, default: 0 },
      solvedProblems: { type: Number, default: 0 },
      attemptedProblems: { type: Number, default: 0 },
      averageDifficulty: { type: Number, default: 0 },
      patternsProgress: [{
        pattern: { type: String, required: true },
        total: { type: Number, default: 0 },
        solved: { type: Number, default: 0 },
        attempted: { type: Number, default: 0 },
        completionRate: { type: Number, default: 0 },
      }],
      languagesUsed: [{
        language: { type: String, required: true },
        problemsCount: { type: Number, default: 0 },
        solvedCount: { type: Number, default: 0 },
      }],
    },

    // System design progress
    systemDesignProgress: {
      totalQuestions: { type: Number, default: 0 },
      answeredQuestions: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      topAreas: [{
        area: { type: String, required: true },
        questions: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
      }],
    },

    // Project interview progress
    projectProgress: {
      totalProjects: { type: Number, default: 0 },
      totalProjectQuestions: { type: Number, default: 0 },
      averageProjectScore: { type: Number, default: 0 },
      projectsWithInterviewPrep: { type: Number, default: 0 },
      topProjects: [{
        projectName: { type: String, required: true },
        questionsAsked: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
      }],
    },

    // Revision progress
    revisionProgress: {
      totalRevisions: { type: Number, default: 0 },
      dueRevisions: { type: Number, default: 0 },
      completedRevisions: { type: Number, default: 0 },
      abandonedRevisions: { type: Number, default: 0 },
      masteredRevisions: { type: Number, default: 0 },
      averageRevisionScore: { type: Number, default: 0 },
    },

    // Mock interview progress
    mockInterviewProgress: {
      totalInterviews: { type: Number, default: 0 },
      completedInterviews: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      interviewTypes: [{
        type: { type: String, required: true },
        total: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
      }],
    },

    // Daily summaries
    dailySummaries: [{
      date: { type: Date, required: true },
      questions: { type: Number, default: 0 },
      answered: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      studyTimeSeconds: { type: Number, default: 0 },
      topics: [String],
    }],

    // Summary metadata
    lastCalculatedAt: { type: Date, default: Date.now },
    calculationVersion: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

// Indexes
userProgressSchema.index({ userId: 1 }, { unique: true });
userProgressSchema.index({ 'dailySummaries.date': 1 });
userProgressSchema.index({ 'topicProgress.topic': 1 });

// Static methods
userProgressSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({ userId });
};

userProgressSchema.statics.upsertForUser = function(userId: mongoose.Types.ObjectId) {
  return this.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, createdAt: new Date() } },
    { upsert: true, new: true }
  );
};

userProgressSchema.methods.incrementQuestion = function(
  type: 'new' | 'revision' | 'mock' | 'project' | 'system_design' | 'coding',
  difficulty: string,
  questionType: string,
  score?: number,
  timeSeconds?: number
) {
  this.totalQuestions += 1;
  totalNewQuestions: this.totalQuestions += 1;

  switch (type) {
    case 'new':
      this.totalNewQuestions += 1;
      break;
    case 'revision':
      this.totalRevisionQuestions += 1;
      break;
    case 'mock':
      this.totalMockQuestions += 1;
      break;
    case 'project':
      this.totalProjectQuestions += 1;
      break;
    case 'system_design':
      this.totalSystemDesignQuestions += 1;
      break;
    case 'coding':
      this.totalCodingQuestions += 1;
      break;
  }

  if (score !== undefined) {
    this.averageScore = recalculateAverage(this.averageScore, this.totalQuestions - 1, score);
    this.bestScore = Math.max(this.bestScore, score);
    this.worstScore = Math.min(this.worstScore, score);

    // Update score distribution
    if (score >= 0.9) {
      this.scoreDistribution.excellent += 1;
    } else if (score >= 0.7) {
      this.scoreDistribution.good += 1;
    } else if (score >= 0.5) {
      this.scoreDistribution.average += 1;
    } else if (score >= 0.3) {
      this.scoreDistribution.poor += 1;
    } else {
      this.scoreDistribution.very_poor += 1;
    }
  }

  if (timeSeconds !== undefined) {
    const oldAverage = this.averageAnswerTimeSeconds;
    const newCount = this.totalQuestions;
    this.averageAnswerTimeSeconds = ((oldAverage * (newCount - 1)) + timeSeconds) / newCount;
  }

  return this;
};

userProgressSchema.methods.recordSession = function(
  questions: number,
  answered: number,
  averageScore: number,
  studyTimeSeconds: number,
  topics: string[]
) {
  // Update streak
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const lastActive = this.lastActiveDate ? new Date(this.lastActiveDate) : null;
  if (lastActive) {
    lastActive.setHours(0, 0, 0, 0);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lastActive && lastActive.getTime() === yesterday.getTime()) {
    this.currentStreak += 1;
  } else if (!lastActive || lastActive.getTime() !== today.getTime()) {
    this.currentStreak = 1;
  }

  this.longestStreak = Math.max(this.longestStreak, this.currentStreak);
  this.lastActiveDate = new Date();
  this.daysActive += 1;
  this.totalDays += 1;
  this.completionRate = (this.answeredQuestions / this.totalQuestions) * 100 || 0;

  this.totalStudyTimeSeconds += studyTimeSeconds;
  this.longestSessionSeconds = Math.max(this.longestSessionSeconds, studyTimeSeconds);
  if (this.shortestSessionSeconds === 0 || studyTimeSeconds < this.shortestSessionSeconds) {
    this.shortestSessionSeconds = studyTimeSeconds;
  }

  // Add daily summary
  const existingSummary = this.dailySummaries.find(s =>
    s.date.toDateString() === new Date().toDateString()
  );

  if (existingSummary) {
    existingSummary.questions += questions;
    existingSummary.answered += answered;
    existingSummary.averageScore = ((existingSummary.averageScore * (existingSummary.questions - answered)) + (averageScore * answered)) / existingSummary.questions;
    existingSummary.studyTimeSeconds += studyTimeSeconds;
  } else {
    this.dailySummaries.push({
      date: new Date(),
      questions,
      answered,
      averageScore,
      studyTimeSeconds,
      topics: [...new Set(topics)],
    });
  }

  return this;
};

userProgressSchema.methods.recalculateAll = async function() {
  // This would be implemented to recalculate all stats from scratch
  // based on actual question history, sessions, etc.
  this.lastCalculatedAt = new Date();
  this.calculationVersion += 1;
  return this.save();
};

// Helper functions
function recalculateAverage(
  currentAverage: number,
  count: number,
  newValue: number
): number {
  if (count === 0) return newValue;
  return ((currentAverage * count) + newValue) / (count + 1);
}

// Create model
const UserProgress: Model<IUserProgressDocument> = mongoose.model<IUserProgressDocument>('UserProgress', userProgressSchema as any);

export { UserProgress };
export default UserProgress;
