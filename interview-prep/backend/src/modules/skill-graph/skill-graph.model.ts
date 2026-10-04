import mongoose, { Schema, Document, Model } from 'mongoose';

// Skill node
export interface ISkillNode {
  name: string;
  category: string;
  level?: 'basic' | 'intermediate' | 'advanced' | 'expert';
  parent?: string;
  weight: number;
  keywords: string[];
  relatedTopics: string[];
  interviewPriority: 'low' | 'medium' | 'high' | 'very_high';
}

// Concept
export interface IConcept {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  topicId?: mongoose.Types.ObjectId;
  subtopicId?: mongoose.Types.ObjectId;
  parentConceptIds: mongoose.Types.ObjectId[];
  childConceptIds: mongoose.Types.ObjectId[];
  difficulty: 'easy' | 'medium' | 'hard';
  interviewPriority: 'low' | 'medium' | 'high' | 'very_high';
  relatedSkills: string[];
  prerequisites: mongoose.Types.ObjectId[];
  isCore: boolean;
  isAdvanced: boolean;
  createdAt: Date;
}

export interface IConceptDocument extends IConcept, Document {}

// Topic
export interface ITopic {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: string;
  subtopics: mongoose.Types.ObjectId[];
  parentTopicId?: mongoose.Types.ObjectId;
  difficulty: 'easy' | 'medium' | 'hard';
  interviewPriority: 'low' | 'medium' | 'high' | 'very_high';
  estimatedStudyHours: number;
  relatedSkills: string[];
  isCore: boolean;
  isAdvanced: boolean;
  tag: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITopicDocument extends ITopic, Document {}

// Subtopic
export interface ISubtopic {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  topicId: mongoose.Types.ObjectId;
  concepts: mongoose.Types.ObjectId[];
  difficulty: 'easy' | 'medium' | 'hard';
  interviewPriority: 'low' | 'medium' | 'high' | 'very_high';
  estimatedStudyHours: number;
  relatedSkills: string[];
  tag: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubtopicDocument extends ISubtopic, Document {}

// User Skill Graph - tracks user's skill mastery
export interface ISkillNodeState {
  skillName: string;
  exposure: number;
  mastery: number;
  weakness: boolean;
  lastStudied?: Date;
  lastIncorrect?: Date;
  questionCount: number;
  correctCount: number;
  incorrectCount: number;
  revisionCorrect: number;
  revisionIncorrect: number;
  averageScore: number;
  lastScore?: number;
  nextReview?: Date;
  strengths?: string[];
  weaknesses?: string[];
  notes?: string;
}

// User Skill Graph
export interface ISkillGraph {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  skills: Record<string, ISkillNodeState>;
  topics: Record<string, {
    exposure: number;
    mastery: number;
    questionCount: number;
    correctCount: number;
    incorrectCount: number;
    lastStudied?: Date;
    weakSubtopics: string[];
    masteredSubtopics: string[];
  }>;
  concepts: Record<string, {
    exposure: number;
    mastery: number;
    questionCount: number;
    correctCount: number;
    incorrectCount: number;
    lastStudied?: Date;
    lastIncorrect?: Date;
    weak: boolean;
    mastered: boolean;
  }>;
  archetypes: Record<string, {
    exposure: number;
    mastery: number;
    questionCount: number;
    lastSeen?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISkillGraphDocument extends ISkillGraph, Document {}

// Update skill state in graph
function updateSkillState(
  currentState: ISkillNodeState | undefined,
  correct: boolean,
  score: number
): ISkillNodeState {
  const now = new Date();
  const updated: ISkillNodeState = {
    skillName: currentState?.skillName || '',
    exposure: (currentState?.exposure || 0) + 1,
    mastery: calculateMastery(currentState?.mastery || 0, correct, score),
    weakness: calculateWeakness(currentState, correct),
    lastStudied: now,
    lastIncorrect: correct ? currentState?.lastIncorrect : now,
    questionCount: (currentState?.questionCount || 0) + 1,
    correctCount: currentState?.correctCount || 0,
    incorrectCount: currentState?.incorrectCount || 0,
    revisionCorrect: currentState?.revisionCorrect || 0,
    revisionIncorrect: currentState?.revisionIncorrect || 0,
    averageScore: calculateAverageScore(currentState, score),
    lastScore: score,
    nextReview: calculateNextReview(correct, currentState?.nextReview),
  };

  updated.correctCount = (updated.correctCount || 0) + (correct ? 1 : 0);
  updated.incorrectCount = (updated.incorrectCount || 0) + (correct ? 0 : 1);

  if (correct && score >= 0.7) {
    updated.revisionCorrect = (updated.revisionCorrect || 0) + 1;
  } else {
    updated.revisionIncorrect = (updated.revisionIncorrect || 0) + 1;
  }

  return updated;
}

function calculateMastery(current: number, correct: boolean, score: number): number {
  const learningRate = 0.1;

  if (correct) {
    return Math.min(1, current + learningRate * score);
  } else {
    return Math.max(0, current - learningRate * (1 - score));
  }
}

function calculateWeakness(state: ISkillNodeState | undefined, correct: boolean): boolean {
  if (!state) return false;
  if (correct) return false;

  const mastery = state.mastery || 0;
  if (mastery < 0.3) return true;

  const incorrectRate = (state.incorrectCount || 0) / (state.questionCount || 1);
  return incorrectRate > 0.3;
}

function calculateAverageScore(state: ISkillNodeState | undefined, newScore: number): number {
  if (!state) return newScore;
  const totalQuestions = (state.questionCount || 0) + 1;
  const totalScore = ((state.averageScore || 0) * (state.questionCount || 0)) + newScore;
  return totalScore / totalQuestions;
}

function calculateNextReview(correct: boolean, currentNextReview?: Date): Date | undefined {
  if (!correct) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  }

  if (currentNextReview) {
    const currentMs = currentNextReview.getTime();
    if (Date.now() >= currentMs) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
    return currentNextReview;
  }

  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

// Skill Graph Schema
const skillGraphSchema = new Schema<ISkillGraph>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    skills: {
      type: Map,
      of: new Schema<ISkillNodeState>({
        skillName: String,
        exposure: { type: Number, default: 0 },
        mastery: { type: Number, default: 0 },
        weakness: { type: Boolean, default: false },
        lastStudied: Date,
        lastIncorrect: Date,
        questionCount: { type: Number, default: 0 },
        correctCount: { type: Number, default: 0 },
        incorrectCount: { type: Number, default: 0 },
        revisionCorrect: { type: Number, default: 0 },
        revisionIncorrect: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
        lastScore: Number,
        nextReview: Date,
        strengths: [String],
        weaknesses: [String],
        notes: String,
      }),
    },
    topics: {
      type: Map,
      of: new Schema({
        exposure: { type: Number, default: 0 },
        mastery: { type: Number, default: 0 },
        questionCount: { type: Number, default: 0 },
        correctCount: { type: Number, default: 0 },
        incorrectCount: { type: Number, default: 0 },
        lastStudied: Date,
        weakSubtopics: [String],
        masteredSubtopics: [String],
      }),
    },
    concepts: {
      type: Map,
      of: new Schema({
        exposure: { type: Number, default: 0 },
        mastery: { type: Number, default: 0 },
        questionCount: { type: Number, default: 0 },
        correctCount: { type: Number, default: 0 },
        incorrectCount: { type: Number, default: 0 },
        lastStudied: Date,
        lastIncorrect: Date,
        weak: { type: Boolean, default: false },
        mastered: { type: Boolean, default: false },
      }),
    },
    archetypes: {
      type: Map,
      of: new Schema({
        exposure: { type: Number, default: 0 },
        mastery: { type: Number, default: 0 },
        questionCount: { type: Number, default: 0 },
        lastSeen: Date,
      }),
    },
  },
  {
    timestamps: true,
  }
);


// Static methods
skillGraphSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({ userId });
};

skillGraphSchema.statics.upsertForUser = async function(userId: mongoose.Types.ObjectId) {
  return this.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, createdAt: new Date() } },
    { upsert: true, new: true }
  );
};

// Methods
skillGraphSchema.methods.updateSkill = async function(
  skillName: string,
  correct: boolean,
  score: number,
  topic?: string,
  concept?: string,
  archetype?: string
) {
  const skillKey = skillName.toLowerCase();

  // Update skill
  const currentSkill = this.skills.get(skillKey);
  const newSkillState = updateSkillState(currentSkill, correct, score);
  this.skills.set(skillKey, newSkillState);

  // Update topic if provided
  if (topic) {
    const topicKey = topic.toLowerCase();
    const currentTopic = this.topics.get(topicKey) || {
      exposure: 0,
      mastery: 0,
      questionCount: 0,
      correctCount: 0,
      incorrectCount: 0,
    };

    currentTopic.exposure += 1;
    currentTopic.questionCount += 1;
    currentTopic.correctCount += correct ? 1 : 0;
    currentTopic.incorrectCount += correct ? 0 : 1;

    // Simple mastery calculation for topic
    if (correct) {
      currentTopic.mastery = Math.min(1, (currentTopic.mastery || 0) + 0.05);
    } else {
      currentTopic.mastery = Math.max(0, (currentTopic.mastery || 0) - 0.03);
    }

    currentTopic.lastStudied = new Date();

    if (correct && (currentTopic.mastery || 0) >= 0.7) {
      const mastered = currentTopic.masteredSubtopics || [];
      if (!mastered.includes(skillKey)) {
        currentTopic.masteredSubtopics = [...mastered, skillKey];
      }
    }

    if (!correct && (currentTopic.mastery || 0) < 0.3) {
      const weak = currentTopic.weakSubtopics || [];
      if (!weak.includes(skillKey)) {
        currentTopic.weakSubtopics = [...weak, skillKey];
      }
    }

    this.topics.set(topicKey, currentTopic);
  }

  // Update concept if provided
  if (concept) {
    const conceptKey = concept.toLowerCase();
    const currentConcept = this.concepts.get(conceptKey) || {
      exposure: 0,
      mastery: 0,
      questionCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      weak: false,
      mastered: false,
    };

    currentConcept.exposure += 1;
    currentConcept.questionCount += 1;
    currentConcept.correctCount += correct ? 1 : 0;
    currentConcept.incorrectCount += correct ? 0 : 1;
    currentConcept.mastery = calculateMastery(currentConcept.mastery, correct, score);
    currentConcept.lastStudied = new Date();

    if (!correct) {
      currentConcept.lastIncorrect = new Date();
      currentConcept.weak = currentConcept.mastery < 0.3;
    }

    if (currentConcept.mastery >= 0.7) {
      currentConcept.mastered = true;
    }

    this.concepts.set(conceptKey, currentConcept);
  }

  // Update archetype if provided
  if (archetype) {
    const archetypeKey = archetype.toLowerCase();
    const currentArchetype = this.archetypes.get(archetypeKey) || {
      exposure: 0,
      mastery: 0,
      questionCount: 0,
    };

    currentArchetype.exposure += 1;
    currentArchetype.questionCount += 1;
    currentArchetype.mastery = calculateMastery(currentArchetype.mastery, correct, score);
    currentArchetype.lastSeen = new Date();

    this.archetypes.set(archetypeKey, currentArchetype);
  }

  await this.save();
  return this;
};

/**
 * Update a single concept's state with a real evaluation score. Unlike
 * updateSkill, this does not touch the skills/topics/archetypes maps, so
 * concept names never pollute skill listings.
 */
skillGraphSchema.methods.updateConcept = async function(
  conceptName: string,
  correct: boolean,
  score: number
) {
  if (!conceptName) return this;

  const conceptKey = conceptName.toLowerCase();
  const currentConcept = this.concepts.get(conceptKey) || {
    exposure: 0,
    mastery: 0,
    questionCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    weak: false,
    mastered: false,
  };

  currentConcept.exposure = (currentConcept.exposure || 0) + 1;
  currentConcept.questionCount = (currentConcept.questionCount || 0) + 1;
  currentConcept.correctCount = (currentConcept.correctCount || 0) + (correct ? 1 : 0);
  currentConcept.incorrectCount = (currentConcept.incorrectCount || 0) + (correct ? 0 : 1);
  currentConcept.mastery = calculateMastery(currentConcept.mastery || 0, correct, score);
  currentConcept.lastStudied = new Date();

  if (!correct) {
    currentConcept.lastIncorrect = new Date();
    currentConcept.weak = (currentConcept.mastery || 0) < 0.3;
  }

  if ((currentConcept.mastery || 0) >= 0.7) {
    currentConcept.mastered = true;
  } else {
    currentConcept.mastered = false;
  }

  this.concepts.set(conceptKey, currentConcept);
  await this.save();
  return this;
};

skillGraphSchema.methods.getWeakSkills = function(limit: number = 10): { name: string; mastery: number; weakness: boolean }[] {
  const weakSkills: { name: string; mastery: number; weakness: boolean }[] = [];

  this.skills.forEach((state, key) => {
    if (state.weakness || (state.mastery || 0) < 0.4) {
      weakSkills.push({
        name: key,
        mastery: state.mastery || 0,
        weakness: state.weakness || false,
      });
    }
  });

  return weakSkills.sort((a, b) => a.mastery - b.mastery).slice(0, limit);
};

skillGraphSchema.methods.getMasteredSkills = function(limit: number = 10): { name: string; mastery: number }[] {
  const mastered: { name: string; mastery: number }[] = [];

  this.skills.forEach((state, key) => {
    if ((state.mastery || 0) >= 0.7) {
      mastered.push({ name: key, mastery: state.mastery || 0 });
    }
  });

  return mastered.sort((a, b) => b.mastery - a.mastery).slice(0, limit);
};

// Create models
const SkillGraph: Model<ISkillGraphDocument> = mongoose.model<ISkillGraphDocument>('SkillGraph', skillGraphSchema as any);
const Concept: Model<IConceptDocument> = mongoose.model<IConceptDocument>('Concept', new Schema({
  name: { type: String, required: true, unique: true, index: true },
  description: { type: String, required: true },
  topicId: { type: Schema.Types.ObjectId, ref: 'Topic' },
  subtopicId: { type: Schema.Types.ObjectId, ref: 'Subtopic' },
  parentConceptIds: [{ type: Schema.Types.ObjectId, ref: 'Concept' }],
  childConceptIds: [{ type: Schema.Types.ObjectId, ref: 'Concept' }],
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  interviewPriority: { type: String, enum: ['low', 'medium', 'high', 'very_high'], default: 'medium' },
  relatedSkills: [String],
  prerequisites: [{ type: Schema.Types.ObjectId, ref: 'Concept' }],
  isCore: { type: Boolean, default: false },
  isAdvanced: { type: Boolean, default: false },
} as any));

const Topic: Model<ITopicDocument> = mongoose.model<ITopicDocument>('Topic', new Schema({
  name: { type: String, required: true, unique: true, index: true },
  description: { type: String, required: true },
  category: { type: String, required: true, index: true },
  subtopics: [{ type: Schema.Types.ObjectId, ref: 'Subtopic' }],
  parentTopicId: { type: Schema.Types.ObjectId, ref: 'Topic' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  interviewPriority: { type: String, enum: ['low', 'medium', 'high', 'very_high'], default: 'medium' },
  estimatedStudyHours: { type: Number, default: 5 },
  relatedSkills: [String],
  isCore: { type: Boolean, default: false },
  isAdvanced: { type: Boolean, default: false },
  tag: { type: String, default: 'technology' },
} as any));

const Subtopic: Model<ISubtopicDocument> = mongoose.model<ISubtopicDocument>('Subtopic', new Schema({
  name: { type: String, required: true, index: true },
  description: { type: String, required: true },
  topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
  concepts: [{ type: Schema.Types.ObjectId, ref: 'Concept' }],
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  interviewPriority: { type: String, enum: ['low', 'medium', 'high', 'very_high'], default: 'medium' },
  estimatedStudyHours: { type: Number, default: 2 },
  relatedSkills: [String],
  tag: { type: String, default: 'technology' },
} as any));

export { SkillGraph, Concept, Topic, Subtopic };
export default SkillGraph;
