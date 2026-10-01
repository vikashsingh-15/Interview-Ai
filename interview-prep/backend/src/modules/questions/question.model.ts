import mongoose, { Schema, Document, Model } from 'mongoose';

// Question type
export type QuestionType =
  | 'FOUNDATIONAL'
  | 'CONCEPTUAL'
  | 'INTERNAL_WORKING'
  | 'IMPLEMENTATION'
  | 'CODE_REASONING'
  | 'DEBUGGING'
  | 'PRODUCTION_SCENARIO'
  | 'PERFORMANCE'
  | 'CONCURRENCY'
  | 'SECURITY'
  | 'FAILURE_SCENARIO'
  | 'DESIGN'
  | 'TRADE_OFF'
  | 'WHY'
  | 'WHY_NOT'
  | 'WHAT_HAPPENS_IF'
  | 'MIGRATION'
  | 'SCALABILITY'
  | 'OBSERVABILITY'
  | 'INCIDENT_RESPONSE'
  | 'ARCHITECTURE'
  | 'RESUME_PROJECT'
  | 'SYSTEM_DESIGN'
  | 'CODING';

// Difficulty
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

// Interview priority
export type InterviewPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

// Resume relevance
export type ResumeRelevance = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

// Expected answer depth
export type AnswerDepth = 'SHORT' | 'MODERATE' | 'DEEP';

// Provenance
export type Provenance =
  | 'CURATED'
  | 'AI_GENERATED'
  | 'RESUME_DERIVED'
  | 'MARKET_CALIBRATED'
  | 'USER_CREATED';

// Archetype
export type QuestionArchetype =
  | 'FOUNDATIONAL'
  | 'CONCEPTUAL'
  | 'INTERNAL_WORKING'
  | 'IMPLEMENTATION'
  | 'CODE_REASONING'
  | 'DEBUGGING'
  | 'PRODUCTION_SCENARIO'
  | 'CONCURRENCY'
  | 'SECURITY'
  | 'FAILURE_SCENARIO'
  | 'TRADE_OFF'
  | 'DESIGN'
  | 'SCALABILITY'
  | 'DEEP_DIVE';

// Question
export interface IQuestion {
  _id: mongoose.Types.ObjectId;

  ownerUserId?: mongoose.Types.ObjectId;
  // Core question
  question: string;
  topic: string;
  subtopic: string;
  concepts: string[];
  difficulty: Difficulty;
  questionType: QuestionType;
  archetype: QuestionArchetype;

  // Metadata
  interviewPriority: InterviewPriority;
  resumeRelevance: ResumeRelevance;
  expectedAnswerDepth: AnswerDepth;
  estimatedAnswerTimeSeconds: number;
  followUpConcepts: string[];
  tags: string[];

  // Provenance
  provenance: Provenance;
  sourceId?: string;
  generatedAt?: Date;
  generatorModel?: string;
  promptVersion?: string;
  marketCalibrationIds?: string[];
  resumeClaimIds?: string[];

  // Uniqueness
  normalizedHash?: string;
  embedding?: number[];
  embeddingModel?: string;
  semanticSignature?: string;

  // Quality
  qualityStatus: 'pending' | 'approved' | 'flagged' | 'rejected';
  qualityScore?: number;
  reviewCount?: number;
  isTemplate: boolean;
  isGeneric: boolean;

  // Content (for reference answers, hints, etc.)
  shortAnswer?: string;
  detailedAnswer?: string;
  interviewAnswer?: string;
  interviewAnswerSections?: {
    direct: string; questionFocus: string; why: string; how: string;
    example: string; tradeOff: string; summary: string;
  };
  internalWorking?: string;
  practicalExample?: string;
  productionContext?: string;
  tradeOffs?: string[];
  commonMistakes?: string[];
  followUpQuestions?: string[];
  sde2Expectations?: string[];
  sixtySecondVersion?: string;
  glossary?: string[];

  // Source URLs (for coding problems)
  sourceUrl?: string;
  sourcePlatform?: string;
  sourceProblemId?: string;

  // System design specific
  isSystemDesign: boolean;
  systemDesignContext?: string;
  functionalRequirements?: string[];
  nonFunctionalRequirements?: string[];
  scaleRequirements?: string[];

  // Coding specific
  isCoding: boolean;
  codingProblem?: {
    description: string;
    inputFormat?: string;
    outputFormat?: string;
    constraints?: string[];
    examples?: Array<{
      input: string;
      output: string;
      explanation?: string;
    }>;
    starterCode?: string;
    solutionCode?: string;
    complexityTime?: string;
    complexitySpace?: string;
    pattern?: string;
  };

  // Project interview specific
  isProjectInterview: boolean;
  projectName?: string;
  projectInterviewTree?: {
    motivation?: string;
    architecture?: string;
    technologyChoices?: string;
    implementation?: string;
    database?: string;
    apis?: string;
    scalability?: string;
    performance?: string;
    security?: string;
    failureHandling?: string;
    testing?: string;
    monitoring?: string;
    tradeoffs?: string;
    alternatives?: string;
  };

  // Flags
  isHidden: boolean;
  isDeprecated: boolean;
  flaggedReason?: string;
  flaggedAt?: Date;
  flaggedBy?: mongoose.Types.ObjectId;

  // Statistics
  viewCount: number;
  usageCount: number;
  averageRating?: number;
  ratingCount?: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface IQuestionDocument extends IQuestion, Document {}

// Question Schema
const questionSchema = new Schema<IQuestion>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    // Core question
    question: {
      type: String,
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: true,
      index: true,
    },
    subtopic: {
      type: String,
      required: true,
      index: true,
    },
    concepts: [{
      type: String,
      index: true,
    }],
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'],
      required: true,
      index: true,
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
      index: true,
    },
    archetype: {
      type: String,
      enum: [
        'FOUNDATIONAL', 'CONCEPTUAL', 'INTERNAL_WORKING', 'IMPLEMENTATION',
        'CODE_REASONING', 'DEBUGGING', 'PRODUCTION_SCENARIO', 'CONCURRENCY',
        'SECURITY', 'FAILURE_SCENARIO', 'TRADE_OFF', 'DESIGN',
        'SCALABILITY', 'DEEP_DIVE'
      ],
      default: 'CONCEPTUAL',
      index: true,
    },

    // Metadata
    interviewPriority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'],
      default: 'MEDIUM',
      index: true,
    },
    resumeRelevance: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'],
      default: 'LOW',
    },
    expectedAnswerDepth: {
      type: String,
      enum: ['SHORT', 'MODERATE', 'DEEP'],
      default: 'MODERATE',
    },
    estimatedAnswerTimeSeconds: {
      type: Number,
      default: 120,
    },
    followUpConcepts: [String],
    tags: [String],

    // Provenance
    provenance: {
      type: String,
      enum: ['CURATED', 'AI_GENERATED', 'RESUME_DERIVED', 'MARKET_CALIBRATED', 'USER_CREATED'],
      required: true,
      index: true,
    },
    sourceId: String,
    generatedAt: Date,
    generatorModel: String,
    promptVersion: String,
    marketCalibrationIds: [String],
    resumeClaimIds: [String],

    // Uniqueness
    normalizedHash: {
      type: String,
    },
    embedding: [Number],
    embeddingModel: String,
    semanticSignature: String,

    // Quality
    qualityStatus: {
      type: String,
      enum: ['pending', 'approved', 'flagged', 'rejected'],
      default: 'pending',
      index: true,
    },
    qualityScore: Number,
    reviewCount: { type: Number, default: 0 },
    isTemplate: { type: Boolean, default: false },
    isGeneric: { type: Boolean, default: true },

    // Content
    shortAnswer: String,
    detailedAnswer: String,
    interviewAnswer: String,
    interviewAnswerSections: Schema.Types.Mixed,
    internalWorking: String,
    practicalExample: String,
    productionContext: String,
    tradeOffs: [String],
    commonMistakes: [String],
    followUpQuestions: [String],
    sde2Expectations: [String],
    sixtySecondVersion: String,
    glossary: [String],

    // Source URLs
    sourceUrl: String,
    sourcePlatform: String,
    sourceProblemId: String,

    // System design
    isSystemDesign: { type: Boolean, default: false },
    systemDesignContext: String,
    functionalRequirements: [String],
    nonFunctionalRequirements: [String],
    scaleRequirements: [String],

    // Coding
    isCoding: { type: Boolean, default: false },
    codingProblem: {
      description: String,
      inputFormat: String,
      outputFormat: String,
      constraints: [String],
      examples: [{
        input: String,
        output: String,
        explanation: String,
      }],
      starterCode: String,
      solutionCode: String,
      complexityTime: String,
      complexitySpace: String,
      pattern: String,
    },

    // Project interview
    isProjectInterview: { type: Boolean, default: false },
    projectName: String,
    projectInterviewTree: {
      motivation: String,
      architecture: String,
      technologyChoices: String,
      implementation: String,
      database: String,
      apis: String,
      scalability: String,
      performance: String,
      security: String,
      failureHandling: String,
      testing: String,
      monitoring: String,
      tradeoffs: String,
      alternatives: String,
    },

    // Flags
    isHidden: { type: Boolean, default: false },
    isDeprecated: { type: Boolean, default: false },
    flaggedReason: String,
    flaggedAt: Date,
    flaggedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Statistics
    viewCount: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },
    averageRating: Number,
    ratingCount: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient queries
questionSchema.index({ topic: 1, subtopic: 1, difficulty: 1 });
questionSchema.index({ topic: 1, provenance: 1 });
questionSchema.index({ concepts: 1 });
questionSchema.index({ interviewPriority: 1, difficulty: 1 });
questionSchema.index({ isHidden: 1, isDeprecated: 1, qualityStatus: 1 });
questionSchema.index({ provenance: 1, topic: 1 });
questionSchema.index({ normalizedHash: 1 }, { unique: true, sparse: true });
questionSchema.index({ sourceUrl: 1 }, { sparse: true });
questionSchema.index({ 'codingProblem.pattern': 1 }, { sparse: true });
questionSchema.index({ 'codingProblem.sourcePlatform': 1 }, { sparse: true });

// Text index for search
questionSchema.index(
  { question: 'text', subtopic: 'text', concepts: 'text', tags: 'text' },
  {
    weights: {
      question: 10,
      subtopic: 5,
      concepts: 3,
      tags: 2,
    },
  }
);

// Methods
questionSchema.methods.incrementViewCount = async function() {
  this.viewCount += 1;
  return this.save();
};

questionSchema.methods.incrementUsageCount = async function() {
  this.usageCount += 1;
  return this.save();
};

questionSchema.methods.calculateNormalizedHash = function(): string {
  // Normalize the question text
  const normalized = this.question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Simple hash (in production, use a proper hash function)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `hash_${Math.abs(hash).toString(36)}`;
};

questionSchema.pre('save', function(next) {
  if (this.isModified('question') && !this.normalizedHash) {
    const normalized = this.question
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash = hash & hash;
    }
    this.normalizedHash = `hash_${Math.abs(hash).toString(36)}`;
  }
  next();
});

// Static methods
questionSchema.statics.findByTopicAndSubtopic = function(
  topic: string,
  subtopic: string,
  options?: { difficulty?: string; provenance?: string; limit?: number }
) {
  const query: any = { topic, subtopic, isHidden: false, isDeprecated: false, qualityStatus: 'approved' };
  if (options?.difficulty) query.difficulty = options.difficulty;
  if (options?.provenance) query.provenance = options.provenance;

  return this.find(query).limit(options?.limit || 10);
};

questionSchema.statics.findSimilarQuestions = function(
  questionId: mongoose.Types.ObjectId,
  limit: number = 5
) {
  const question = this.findById(questionId);
  if (!question) return this.find({});

  return this.find({
    _id: { $ne: questionId },
    topic: question.topic,
    subtopic: question.subtopic,
    isHidden: false,
    isDeprecated: false,
    qualityStatus: 'approved',
  }).limit(limit);
};

questionSchema.statics.findDuplicateCandidates = function(
  questionText: string,
  existingHash?: string
) {
  const normalized = questionText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hash = `hash_${Math.abs(
    normalized.split('').reduce((acc, char) => {
      const charCode = char.charCodeAt(0);
      return ((acc << 5) - acc) + charCode;
    }, 0)
  ).toString(36)}`;

  if (existingHash) {
    return this.find({
      normalizedHash: hash,
      _id: { $ne: existingHash },
    });
  }

  return this.find({
    normalizedHash: hash,
  });
};

questionSchema.statics.findForSession = function(
  topic: string,
  subtopic: string,
  difficultyDistribution: { EASY: number; MEDIUM: number; HARD: number; EXPERT: number },
  excludeHashes: string[] = [],
  excludeConcepts: string[] = [],
  limit: number = 10
) {
  const filter: any = {
    topic,
    subtopic,
    isHidden: false,
    isDeprecated: false,
    qualityStatus: 'approved',
    normalizedHash: { $nin: excludeHashes },
  };

  if (excludeConcepts.length > 0) {
    filter.concepts = { $nin: excludeConcepts.map(c => new RegExp(c, 'i')) };
  }

  // Prioritize by interview priority and usage count (prefer less-used questions)
  return this.find(filter)
    .sort({ interviewPriority: -1, usageCount: 1, createdAt: -1 })
    .limit(limit);
};

// Create model
const Question: Model<IQuestionDocument> = mongoose.model<IQuestionDocument>('Question', questionSchema as any);

export { Question };
export default Question;
