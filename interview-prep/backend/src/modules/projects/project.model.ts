import mongoose, { Schema, Document, Model } from 'mongoose';

// Project category
export type ProjectCategory =
  | 'personal'
  | 'work'
  | 'open_source'
  | 'academic'
  | 'freelance'
  | 'startup'
  | 'other';

// Project status
export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';

// Project
export interface IProject {
  _id: mongoose.Types.ObjectId;

  // User reference
  userId: mongoose.Types.ObjectId;

  // Basic info
  name: string;
  slug: string;
  description: string;
  category: ProjectCategory;
  status: ProjectStatus;

  // Timeline
  startDate?: Date;
  endDate?: Date;
  isCurrent: boolean;
  totalDurationMonths?: number;

  // Role and team
  role: string;
  teamSize?: number;
  teamRoles?: string[];
  myContribution: string;

  // Technologies
  technologies: string[];
  technologiesByCategory: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    cloud: string[];
    devops: string[];
    ai_ml: string[];
    tools: string[];
    other: string[];
  };

  // Architecture and design
  architectureType: string[];
  architectureDescription?: string;
  keyDesignDecisions: string[];
  tradeOffsConsidered: string[];

  // Features
  features: string[];
  featuresDescription: string[];

  // Technical claims
  performanceClaims: string[];
  scaleClaims: string[];
  securityClaims: string[];
  reliabilityClaims: string[];

  // Metrics and measurements
  metrics: {
    type: string;
    value: string;
    unit: string;
    description: string;
  }[];

  // Interview preparation
  interviewTree: {
    motivation: {
      whyBuilt: string;
      problemSolved: string;
      alternativesConsidered: string[];
    };
    architecture: {
      highLevelDesign: string;
      components: string[];
      componentRelationships: string[];
      dataFlow: string;
    };
    technologyChoices: {
      whyChosen: string[];
      whyNotAlternatives: string[];
      migrationConsiderations: string[];
    };
    implementation: {
      keyChallenges: string[];
      solutions: string[];
      lessonsLearned: string[];
    };
    database: {
      type: string;
      schemaDesign: string;
      indexingStrategy: string;
      queryPatterns: string[];
    };
    apis: {
      type: string;
      designPrinciples: string[];
      keyEndpoints: string[];
      versioningStrategy: string;
    };
    scalability: {
      currentScale: string;
      scalingApproach: string[];
      bottlenecks: string[];
      scalingSolutions: string[];
    };
    performance: {
      criticalMetrics: string[];
      optimizationTechniques: string[];
      cachingStrategy: string;
    };
    security: {
      authentication: string;
      authorization: string;
      dataProtection: string[];
      commonVulnerabilitiesAddressed: string[];
    };
    failureHandling: {
      failureModes: string[];
      recoveryStrategies: string[];
      monitoring: string[];
    };
    testing: {
      testTypes: string[];
      coverage: string;
      keyTestCases: string[];
    };
    monitoring: {
      metricsTracked: string[];
      alerting: string[];
      logging: string;
    };
  };

  // Resume reference
  resumeProfileId?: mongoose.Types.ObjectId;
  resumeVersionId?: mongoose.Types.ObjectId;
  isVerifiedFromResume: boolean;
  verifiedAt?: Date;

  // Question history
  totalQuestionsAsked: number;
  lastQuestionDate?: Date;
  questionHistoryIds: mongoose.Types.ObjectId[];

  // User flags
  isPinned: boolean;
  isHidden: boolean;
  notes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectDocument extends IProject, Document {}

// Interview Tree Schema (subdocument)
const interviewTreeSchema = new Schema({
  motivation: {
    whyBuilt: String,
    problemSolved: String,
    alternativesConsidered: [String],
  },
  architecture: {
    highLevelDesign: String,
    components: [String],
    componentRelationships: [String],
    dataFlow: String,
  },
  technologyChoices: {
    whyChosen: [String],
    whyNotAlternatives: [String],
    migrationConsiderations: [String],
  },
  implementation: {
    keyChallenges: [String],
    solutions: [String],
    lessonsLearned: [String],
  },
  database: {
    type: String,
    schemaDesign: String,
    indexingStrategy: String,
    queryPatterns: [String],
  },
  apis: {
    type: String,
    designPrinciples: [String],
    keyEndpoints: [String],
    versioningStrategy: String,
  },
  scalability: {
    currentScale: String,
    scalingApproach: [String],
    bottlenecks: [String],
    scalingSolutions: [String],
  },
  performance: {
    criticalMetrics: [String],
    optimizationTechniques: [String],
    cachingStrategy: String,
  },
  security: {
    authentication: String,
    authorization: String,
    dataProtection: [String],
    commonVulnerabilitiesAddressed: [String],
  },
  failureHandling: {
    failureModes: [String],
    recoveryStrategies: [String],
    monitoring: [String],
  },
  testing: {
    testTypes: [String],
    coverage: String,
    keyTestCases: [String],
  },
  monitoring: {
    metricsTracked: [String],
    alerting: [String],
    logging: String,
  },
});

// Project Schema
const projectSchema = new Schema<IProject>(
  {
    // User reference
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Basic info
    name: {
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
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['personal', 'work', 'open_source', 'academic', 'freelance', 'startup', 'other'],
      default: 'personal',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'archived'],
      default: 'active',
    },

    // Timeline
    startDate: Date,
    endDate: Date,
    isCurrent: { type: Boolean, default: false },
    totalDurationMonths: Number,

    // Role and team
    role: {
      type: String,
      required: true,
    },
    teamSize: Number,
    teamRoles: [String],
    myContribution: String,

    // Technologies
    technologies: [String],
    technologiesByCategory: {
      languages: [String],
      frameworks: [String],
      databases: [String],
      cloud: [String],
      devops: [String],
      ai_ml: [String],
      tools: [String],
      other: [String],
    },

    // Architecture and design
    architectureType: [String],
    architectureDescription: String,
    keyDesignDecisions: [String],
    tradeOffsConsidered: [String],

    // Features
    features: [String],
    featuresDescription: [String],

    // Technical claims
    performanceClaims: [String],
    scaleClaims: [String],
    securityClaims: [String],
    reliabilityClaims: [String],

    // Metrics
    metrics: [{
      type: String,
      value: String,
      unit: String,
      description: String,
    }],

    // Interview preparation
    interviewTree: interviewTreeSchema,

    // Resume reference
    resumeProfileId: { type: Schema.Types.ObjectId, ref: 'ResumeProfile' },
    resumeVersionId: { type: Schema.Types.ObjectId, ref: 'ResumeVersion' },
    isVerifiedFromResume: { type: Boolean, default: false },
    verifiedAt: Date,

    // Question history
    totalQuestionsAsked: { type: Number, default: 0 },
    lastQuestionDate: Date,
    questionHistoryIds: [{ type: Schema.Types.ObjectId, ref: 'QuestionHistory' }],

    // User flags
    isPinned: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    notes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
projectSchema.index({ userId: 1, slug: 1 }, { unique: true });
projectSchema.index({ userId: 1, status: 1 });
projectSchema.index({ userId: 1, isPinned: 1, status: 1 });
projectSchema.index({ userId: 1, isHidden: 1 });
projectSchema.index({ userId: 1, 'technologies': 1 });
projectSchema.index({ userId: 1, 'technologiesByCategory.languages': 1 });
projectSchema.index({ userId: 1, 'technologiesByCategory.frameworks': 1 });
projectSchema.index({ userId: 1, 'technologiesByCategory.databases': 1 });
projectSchema.index({ userId: 1, 'technologiesByCategory.cloud': 1 });
projectSchema.index({ userId: 1, 'technologiesByCategory.ai_ml': 1 });

// Text index for search
projectSchema.index(
  { name: 'text', description: 'text', features: 'text', featuresDescription: 'text' },
  {
    weights: {
      name: 10,
      description: 5,
      features: 3,
      featuresDescription: 2,
    },
  }
);

// Virtual for current project
projectSchema.virtual('isActive').get(function() {
  return this.isCurrent || (!this.endDate || new Date() <= this.endDate);
});

// Virtual for project completion percentage
projectSchema.virtual('completionPercentage').get(function() {
  if (this.status === 'completed') return 100;
  if (this.status === 'archived') return 100;
  if (this.status === 'draft') return 0;

  // Estimate based on interview tree completeness
  const treeSections = [
    'motivation', 'architecture', 'technologyChoices', 'implementation',
    'database', 'apis', 'scalability', 'performance', 'security',
    'failureHandling', 'testing', 'monitoring'
  ];

  let completeSections = 0;
  const tree = this.interviewTree as any;
  for (const section of treeSections) {
    const sectionData = tree[section];
    if (sectionData && Object.values(sectionData).some((v: any) => v && (typeof v === 'string' ? v.length > 0 : v.length > 0))) {
      completeSections++;
    }
  }

  return Math.round((completeSections / treeSections.length) * 100);
});

// Methods
projectSchema.methods.incrementQuestionsAsked = async function(questionHistoryId: mongoose.Types.ObjectId) {
  this.totalQuestionsAsked += 1;
  this.lastQuestionDate = new Date();
  this.questionHistoryIds.push(questionHistoryId);
  return this.save();
};

projectSchema.methods.updateInterviewTree = async function(section: string, data: any) {
  if (this.interviewTree) {
    (this.interviewTree as any)[section] = { ...(this.interviewTree[section] || {}), ...data };
  } else {
    this.interviewTree = { [section]: data } as any;
  }
  return this.save();
};

projectSchema.methods.markVerifiedFromResume = async function(resumeProfileId: mongoose.Types.ObjectId, resumeVersionId: mongoose.Types.ObjectId) {
  this.resumeProfileId = resumeProfileId;
  this.resumeVersionId = resumeVersionId;
  this.isVerifiedFromResume = true;
  this.verifiedAt = new Date();
  return this.save();
};

projectSchema.methods.generateSlug = async function(): Promise<string> {
  const baseSlug = this.name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  // Check for uniqueness and add suffix if needed
  let slug = baseSlug;
  let counter = 1;
  const ProjectModel = mongoose.model('Project');

  while (await ProjectModel.exists({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

// Static methods
projectSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId, isHidden: false })
    .sort({ isPinned: -1, createdAt: -1 });
};

projectSchema.statics.findBySlug = function(slug: string) {
  return this.findOne({ slug, isHidden: false });
};

projectSchema.statics.findForInterview = function(
  userId: mongoose.Types.ObjectId,
  technologies?: string[]
) {
  let query: any = { userId, isHidden: false, status: 'active' };

  if (technologies && technologies.length > 0) {
    query.$or = technologies.map(tech => ({
      technologies: { $regex: tech, $options: 'i' },
    }));
  }

  return this.find(query).sort({ isPinned: -1, totalQuestionsAsked: 1 });
};

projectSchema.statics.getProjectReadiness = function(userId: mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { userId, isHidden: false } },
    {
      $group: {
        _id: null,
        totalProjects: { $sum: 1 },
        totalQuestionsAsked: { $sum: '$totalQuestionsAsked' },
        averageCompletion: { $avg: '$completionPercentage' },
        projectsWithInterviewTree: {
          $sum: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$interviewTree', {}] } }, 0] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
};

// Create model
const Project: Model<IProjectDocument> = mongoose.model<IProjectDocument>('Project', projectSchema as any);

export { Project };
export default Project;
