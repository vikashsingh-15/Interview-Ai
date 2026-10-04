import mongoose, { Schema, Document, Model } from 'mongoose';

// Problem difficulty
export type ProblemDifficulty = 'easy' | 'medium' | 'hard';

// Problem pattern
export type ProblemPattern =
  | 'arrays'
  | 'strings'
  | 'linked_lists'
  | 'trees'
  | 'graphs'
  | 'dynamic_programming'
  | 'backtracking'
  | 'sorting'
  | 'searching'
  | 'greedy'
  | 'intervals'
  | 'math'
  | 'geometry'
  | 'bit_manipulation'
  | 'tries'
  | 'heap'
  | 'stack'
  | 'queue'
  | 'two_pointers'
  | 'sliding_window'
  | 'binary_search'
  | 'union_find'
  | 'segment_tree'
  | 'prefix_sum'
  | 'monotonic_stack'
  | 'topological_sort'
  | 'shortest_path'
  | 'minimum_spanning_tree'
  | 'flow'
  | 'dp_on_graphs';

// Source platform
export type ProblemPlatform = 'leetcode' | 'hackerrank' | 'codeforces' | 'atcoder' | 'custom' | 'interview_practice';

// Coding problem
export interface ICodingProblem {
  _id: mongoose.Types.ObjectId;

  // Problem info
  title: string;
  slug: string;
  description: string;
  difficulty: ProblemDifficulty;
  pattern: ProblemPattern[];

  // Source
  platform: ProblemPlatform;
  problemId?: string;
  url?: string;

  // Content
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string[];
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;

  // Solution
  starterCode?: Record<string, string>; // language -> code
  solutionCode?: Record<string, string>;
  solutionExplanation?: string;
  complexityTime?: string;
  complexitySpace?: string;

  // Metadata
  tags: string[];
  relatedTopics: string[];
  isPremium?: boolean;
  isInterviewRelevant: boolean;
  frequency: 'rare' | 'occasional' | 'common' | 'frequent';

  // Status
  isHidden: boolean;
  isDeprecated: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ICodingProblemDocument extends ICodingProblem, Document {}

// Coding Problem Schema
const codingProblemSchema = new Schema<ICodingProblem>(
  {
    title: {
      type: String,
      required: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
      index: true,
    },
    pattern: [{
      type: String,
      enum: [
        'arrays', 'strings', 'linked_lists', 'trees', 'graphs', 'dynamic_programming',
        'backtracking', 'sorting', 'searching', 'greedy', 'intervals', 'math',
        'geometry', 'bit_manipulation', 'tries', 'heap', 'stack', 'queue',
        'two_pointers', 'sliding_window', 'binary_search', 'union_find',
        'segment_tree', 'prefix_sum', 'monotonic_stack', 'topological_sort',
        'shortest_path', 'minimum_spanning_tree', 'flow', 'dp_on_graphs'
      ],
      index: true,
    }],

    // Source
    platform: {
      type: String,
      enum: ['leetcode', 'hackerrank', 'codeforces', 'atcoder', 'custom', 'interview_practice'],
      required: true,
    },
    problemId: {
      type: String,
      index: true,
    },
    url: String,

    // Content
    inputFormat: String,
    outputFormat: String,
    constraints: [String],
    examples: [{
      input: String,
      output: String,
      explanation: String,
    }],

    // Solution
    starterCode: {
      type: Map,
      of: String,
    },
    solutionCode: {
      type: Map,
      of: String,
    },
    solutionExplanation: String,
    complexityTime: String,
    complexitySpace: String,

    // Metadata
    tags: [String],
    relatedTopics: [String],
    isPremium: { type: Boolean, default: false },
    isInterviewRelevant: { type: Boolean, default: true },
    frequency: {
      type: String,
      enum: ['rare', 'occasional', 'common', 'frequent'],
      default: 'occasional',
    },

    // Status
    isHidden: { type: Boolean, default: false },
    isDeprecated: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
codingProblemSchema.index({ platform: 1, problemId: 1 }, { unique: true, partialFilterExpression: { platform: { $in: ['leetcode', 'hackerrank', 'codeforces', 'atcoder'] } } });
codingProblemSchema.index({ difficulty: 1, isInterviewRelevant: 1 });
codingProblemSchema.index({ platform: 1, isInterviewRelevant: 1 });
codingProblemSchema.index({ tags: 1 });
codingProblemSchema.index({ relatedTopics: 1 });
codingProblemSchema.index({ isHidden: 1, isDeprecated: 1, isInterviewRelevant: 1 });
codingProblemSchema.index({ frequency: 1, difficulty: 1 });

// Text index for search
codingProblemSchema.index(
  { title: 'text', description: 'text', tags: 'text' },
  {
    weights: {
      title: 10,
      description: 5,
      tags: 3,
    },
  }
);

// Static methods
codingProblemSchema.statics.findByPlatformAndId = function(platform: ProblemPlatform, problemId: string) {
  return this.findOne({ platform, problemId });
};

codingProblemSchema.statics.findRecommended = function(
  difficulty: ProblemDifficulty = 'medium',
  patterns?: ProblemPattern[],
  limit: number = 10
) {
  const filter: any = {
    isHidden: false,
    isDeprecated: false,
    isInterviewRelevant: true,
  };

  if (difficulty) {
    filter.difficulty = difficulty;
  }

  if (patterns && patterns.length > 0) {
    filter.pattern = { $in: patterns };
  }

  return this.find(filter)
    .sort({ frequency: -1, title: 1 })
    .limit(limit);
};

codingProblemSchema.statics.findByPattern = function(pattern: ProblemPattern, difficulty?: ProblemDifficulty) {
  const filter: any = { pattern: { $in: [pattern] }, isHidden: false, isDeprecated: false };

  if (difficulty) {
    filter.difficulty = difficulty;
  }

  return this.find(filter).sort({ frequency: -1 });
};

// Create model
const CodingProblem: Model<ICodingProblemDocument> = mongoose.model<ICodingProblemDocument>('CodingProblem', codingProblemSchema as any);

// Coding History
export interface ICodingHistory {
  _id: mongoose.Types.ObjectId;

  // User reference
  userId: mongoose.Types.ObjectId;

  // Problem reference
  problemId: mongoose.Types.ObjectId;
  problemSnapshot: {
    title: string;
    slug: string;
    difficulty: ProblemDifficulty;
    pattern: ProblemPattern[];
    platform: ProblemPlatform;
    url?: string;
  };

  // Session context
  sessionId?: mongoose.Types.ObjectId;
  sessionDate?: Date;

  // Attempt info
  language: string;
  code?: string;
  startTime?: Date;
  endTime?: Date;
  timeSpentSeconds?: number;

  // Status
  status: 'not_started' | 'attempted' | 'solved' | 'skipped' | 'failed';
  attempts: number;
  lastAttemptDate?: Date;

  // Result
  isCorrect?: boolean;
  testCasesPassed?: number;
  totalTestCases?: number;
  runtime?: number;
  memory?: number;

  // User notes
  hintsUsed?: string[];
  notes?: string;
  selfRating?: number; // 1-5

  // Review status
  isReviewed: boolean;
  reviewedAt?: Date;
  reviewNotes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ICodingHistoryDocument extends ICodingHistory, Document {}

// Coding History Schema
const codingHistorySchema = new Schema<ICodingHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    problemId: {
      type: Schema.Types.ObjectId,
      ref: 'CodingProblem',
      required: true,
      index: true,
    },
    problemSnapshot: {
      title: { type: String, required: true },
      slug: { type: String, required: true },
      difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        required: true,
      },
      pattern: [String],
      platform: {
        type: String,
        enum: ['leetcode', 'hackerrank', 'codeforces', 'atcoder', 'custom', 'interview_practice'],
        required: true,
      },
      url: String,
    },

    sessionId: { type: Schema.Types.ObjectId, ref: 'DailySession' },
    sessionDate: Date,

    language: String,
    code: String,
    startTime: Date,
    endTime: Date,
    timeSpentSeconds: Number,

    status: {
      type: String,
      enum: ['not_started', 'attempted', 'solved', 'skipped', 'failed'],
      default: 'not_started',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastAttemptDate: Date,

    isCorrect: Boolean,
    testCasesPassed: Number,
    totalTestCases: Number,
    runtime: Number,
    memory: Number,

    hintsUsed: [String],
    notes: String,
    selfRating: Number,

    isReviewed: { type: Boolean, default: false },
    reviewedAt: Date,
    reviewNotes: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
codingHistorySchema.index({ userId: 1, problemId: 1 }, { unique: true });
codingHistorySchema.index({ userId: 1, status: 1 });
codingHistorySchema.index({ userId: 1, 'problemSnapshot.difficulty': 1 });
codingHistorySchema.index({ userId: 1, 'problemSnapshot.pattern': 1 });
codingHistorySchema.index({ userId: 1, sessionId: 1 });
codingHistorySchema.index({ userId: 1, lastAttemptDate: -1 });
codingHistorySchema.index({ userId: 1, isReviewed: 1 });

// Methods
codingHistorySchema.methods.recordAttempt = async function(
  code: string,
  language: string,
  isCorrect: boolean,
  testCasesPassed: number,
  totalTestCases: number,
  runtime?: number,
  memory?: number,
  hintsUsed?: string[]
) {
  this.code = code;
  this.language = language;
  this.isCorrect = isCorrect;
  this.testCasesPassed = testCasesPassed;
  this.totalTestCases = totalTestCases;
  this.runtime = runtime;
  this.memory = memory;
  this.hintsUsed = hintsUsed;
  this.attempts += 1;
  this.lastAttemptDate = new Date();
  this.endTime = new Date();

  if (isCorrect) {
    this.status = 'solved';
  } else {
    this.status = 'attempted';
  }

  return this.save();
};

codingHistorySchema.methods.skip = async function() {
  this.status = 'skipped';
  this.endTime = new Date();
  return this.save();
};

codingHistorySchema.methods.review = async function(notes: string, rating: number) {
  this.isReviewed = true;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  this.selfRating = rating;
  return this.save();
};

// Static methods
codingHistorySchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

codingHistorySchema.statics.findByProblemId = function(problemId: mongoose.Types.ObjectId) {
  return this.find({ problemId });
};

codingHistorySchema.statics.getStats = function(userId: mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        averageAttempts: { $avg: '$attempts' },
        averageTimeSpent: { $avg: '$timeSpentSeconds' },
        averageSelfRating: { $avg: '$selfRating' },
      },
    },
  ]);
};

codingHistorySchema.statics.getPatternStats = function(userId: mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $unwind: '$problemSnapshot.pattern',
    },
    {
      $group: {
        _id: '$problemSnapshot.pattern',
        total: { $sum: 1 },
        solved: {
          $sum: { $cond: [{ $eq: ['$status', 'solved'] }, 1, 0] },
        },
        attempted: {
          $sum: { $cond: [{ $eq: ['$status', 'attempted'] }, 1, 0] },
        },
        averageRating: { $avg: '$selfRating' },
      },
    },
    {
      $project: {
        _id: 0,
        pattern: '$_id',
        total: 1,
        solved: 1,
        attempted: 1,
        completionRate: {
          $cond: [
            { $gt: ['$total', 0] },
            { $multiply: [{ $divide: ['$solved', '$total'] }, 100] },
            0,
          ],
        },
        averageRating: 1,
      },
    },
    { $sort: { completionRate: 1 } },
  ]);
};

// Create model
const CodingHistory: Model<ICodingHistoryDocument> = mongoose.model<ICodingHistoryDocument>('CodingHistory', codingHistorySchema as any);

export { CodingProblem, CodingHistory };
export default CodingProblem;
