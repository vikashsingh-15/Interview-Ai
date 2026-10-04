import mongoose, { Schema, Model } from 'mongoose';

// Skill category
export type SkillCategory =
  | 'programming_language'
  | 'framework'
  | 'library'
  | 'database'
  | 'cloud'
  | 'devops'
  | 'ai_ml'
  | 'security'
  | 'architecture'
  | 'messaging'
  | 'distributed_systems'
  | 'testing'
  | 'frontend'
  | 'mobile'
  | 'other';

// Experience entry
export interface IExperience {
  isConfirmed?: boolean;
  isRemoved?: boolean;
  company: string;
  role: string;
  location?: string;
  startDate?: Date | string;
  endDate: Date | string | null;
  currentRole: boolean;
  totalMonths?: number;
  responsibilities: string[];
  technologies: string[];
  achievements: string[];
  projectReferences: string[];
  technicalClaims: string[];
  _id?: mongoose.Types.ObjectId;
}

// Project entry
export interface IProject {
  isConfirmed?: boolean;
  isRemoved?: boolean;
  name: string;
  description: string;
  startDate?: Date | string;
  endDate?: Date | string;
  isCurrent?: boolean;
  technologies: string[];
  responsibilities: string[];
  architectureClaims: string[];
  features: string[];
  performanceClaims: string[];
  metrics: string[];
  securityClaims: string[];
  technicalDecisions: string[];
  teamSize?: number;
  role?: string;
  _id?: mongoose.Types.ObjectId;
}

// Education entry
export interface IEducation {
  institution: string;
  degree: string;
  field: string;
  startDate?: Date | string;
  endDate?: Date | string;
  gpa?: number;
  honors?: string[];
  _id?: mongoose.Types.ObjectId;
}

// Certification entry
export interface ICertification {
  name: string;
  issuer: string;
  date?: Date | string;
  expiration?: Date | string;
  credentialId?: string;
  url?: string;
  _id?: mongoose.Types.ObjectId;
}

// Extracted skill with confirmation status
export interface IExtractedSkill {
  name: string;
  category: SkillCategory;
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  confidence: number;
  source: 'parser' | 'user' | 'ai_suggested';
  isConfirmed: boolean;
  isRemoved: boolean;
  _id?: mongoose.Types.ObjectId;
}

// Resume Profile
export interface IResumeProfile {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  resumeVersionId: mongoose.Types.ObjectId;
  versionNumber: number;

  // Personal info
  fullName?: string;
  currentRole?: string;
  totalExperienceMonths?: number;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;

  // Extracted information
  skills: IExtractedSkill[];
  experience: IExperience[];
  projects: IProject[];
  education: IEducation[];
  certifications: ICertification[];

  // Parsing metadata
  parserVersion: string;
  confidence: number;
  parsingNotes?: string[];
  extractedAt: Date;

  // User modifications
  userModified: boolean;
  modifiedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type IResumeProfileDocument = IResumeProfile & mongoose.Document<any>;

// Resume Profile Schema
const resumeProfileSchema = new Schema<IResumeProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resumeVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'ResumeVersion',
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },

    // Personal info
    fullName: String,
    currentRole: String,
    totalExperienceMonths: Number,
    email: String,
    phone: String,
    location: String,
    linkedinUrl: String,
    githubUrl: String,

    // Extracted information - using embedded documents
    skills: [{
      name: { type: String, required: true },
      category: {
        type: String,
        enum: [
          'programming_language', 'framework', 'library', 'database',
          'cloud', 'devops', 'ai_ml', 'security', 'architecture',
          'messaging', 'distributed_systems', 'testing', 'frontend', 'mobile', 'other'
        ],
        required: true,
      },
      proficiency: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      },
      confidence: { type: Number, min: 0, max: 1, default: 0.5 },
      source: { type: String, enum: ['parser', 'user', 'ai_suggested'], default: 'parser' },
      isConfirmed: { type: Boolean, default: false },
      isRemoved: { type: Boolean, default: false },
    }],
    experience: [{
      isConfirmed: { type: Boolean, default: false },
      isRemoved: { type: Boolean, default: false },
      company: { type: String, required: true },
      role: { type: String, required: true },
      location: String,
      startDate: Date,
      endDate: { type: Date, default: null },
      currentRole: { type: Boolean, default: false },
      totalMonths: Number,
      responsibilities: [String],
      technologies: [String],
      achievements: [String],
      projectReferences: [String],
      technicalClaims: [String],
    }],
    projects: [{
      isConfirmed: { type: Boolean, default: false },
      isRemoved: { type: Boolean, default: false },
      name: { type: String, required: true },
      description: { type: String, required: true },
      startDate: Date,
      endDate: Date,
      isCurrent: { type: Boolean, default: false },
      technologies: [String],
      responsibilities: [String],
      architectureClaims: [String],
      features: [String],
      performanceClaims: [String],
      metrics: [String],
      securityClaims: [String],
      technicalDecisions: [String],
      teamSize: Number,
      role: String,
    }],
    education: [{
      institution: { type: String, required: true },
      degree: { type: String, required: true },
      field: { type: String, required: true },
      startDate: Date,
      endDate: Date,
      gpa: Number,
      honors: [String],
    }],
    certifications: [{
      name: { type: String, required: true },
      issuer: { type: String, required: true },
      date: Date,
      expiration: Date,
      credentialId: String,
      url: String,
    }],

    // Parsing metadata
    parserVersion: {
      type: String,
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    parsingNotes: [String],
    extractedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // User modifications
    userModified: {
      type: Boolean,
      default: false,
    },
    modifiedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
resumeProfileSchema.index({ userId: 1, resumeVersionId: 1 }, { unique: true });
resumeProfileSchema.index({ userId: 1, userModified: 1 });
resumeProfileSchema.index({ userId: 1, 'skills.name': 1, 'skills.isRemoved': 1 });
resumeProfileSchema.index({ userId: 1, 'experience.company': 1 });
resumeProfileSchema.index({ userId: 1, 'projects.name': 1 });

// Methods
resumeProfileSchema.methods.confirmSkill = async function(skillName: string) {
  const skill = this.skills.find(s => s.name === skillName);
  if (skill) {
    skill.isConfirmed = true;
    skill.source = 'user';
    this.userModified = true;
    this.modifiedAt = new Date();
    await this.save();
  }
  return this;
};

resumeProfileSchema.methods.removeSkill = async function(skillName: string) {
  const skill = this.skills.find(s => s.name === skillName);
  if (skill) {
    skill.isRemoved = true;
    this.isModified = true;
    this.modifiedAt = new Date();
    await this.save();
  }
  return this;
};

resumeProfileSchema.methods.addSkill = async function(skill: Omit<IExtractedSkill, '_id'>) {
  this.skills.push(skill);
  this.isModified = true;
  this.modifiedAt = new Date();
  await this.save();
  return this;
};

// Create model
const ResumeProfile: Model<IResumeProfileDocument> = mongoose.model<IResumeProfileDocument>('ResumeProfile', resumeProfileSchema as any);

export { ResumeProfile };
export default ResumeProfile;
