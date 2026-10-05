// User types
export interface User {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
  preferences: UserPreferences;
  createdAt: string;
}

export type DifficultyChoice = 'easy' | 'medium' | 'hard' | 'extra_hard' | 'mixed';

export interface UserPreferences {
  dailyQuestions: number;
  codingCount: number;
  systemDesignCount: number;
  projectQuestions: number;
  difficulty: DifficultyChoice;
  studyDays: number;
  focusTopics: string[];
  excludedTopics: string[];
  revisionFrequency: 'daily' | 'weekly' | 'biweekly';
  mockInterviewDuration: number;
  notifyEmail: boolean;
  notifyBrowser: boolean;
}

// Resume types
export interface Resume {
  id: string;
  name: string;
  targetRole?: string;
  isActive: boolean;
  currentVersionId: string;
  versions: string[];
  uploadDate: string;
  totalVersions: number;
}

export interface ResumeSummary {
  id: string;
  name: string;
  targetRole?: string;
  isActive: boolean;
  currentVersionId?: string;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
  skills: string[];
  projectsCount: number;
  experienceCount: number;
  experienceSummary: Array<{ company: string; role: string; summary: string[] }>;
  projectSummary: Array<{ name: string; description: string; technologies: string[] }>;
}

export interface ResumeVersion {
  id: string;
  versionNumber: number;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  parsed: boolean;
  parseStatus: 'pending' | 'processing' | 'completed' | 'failed';
  parsedAt?: string;
  createdAt: string;
  isCurrent?: boolean;
}

export interface ResumeProfile {
  id: string;
  versionNumber: number;
  fullName?: string;
  currentRole?: string;
  totalExperienceMonths?: number;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  skills: ResumeSkill[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  certifications: ResumeCertification[];
  confidence: number;
  isModified: boolean;
}

export interface ResumeSkill {
  name: string;
  category: string;
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  confidence: number;
  isConfirmed: boolean;
  isRemoved: boolean;
}

export interface ResumeExperience {
  company: string;
  role: string;
  location?: string;
  startDate: string;
  endDate?: string;
  currentRole: boolean;
  responsibilities: string[];
  technologies: string[];
  achievements: string[];
}

export interface ResumeProject {
  name: string;
  description: string;
  technologies: string[];
  responsibilities: string[];
  architectureClaims: string[];
  features: string[];
  performanceClaims: string[];
  metrics: string[];
  securityClaims: string[];
  myContribution: string;
  teamSize?: number;
}

export interface ResumeEducation {
  institution: string;
  degree: string;
  field: string;
  startDate?: string;
  endDate?: string;
  gpa?: number;
}

export interface ResumeCertification {
  name: string;
  issuer: string;
  date?: string;
  credentialId?: string;
}

// Interview Profile types
export interface InterviewProfile {
  id: string;
  experienceLevel: string;
  targetRole: string;
  targetCompanies: string[];
  primaryLanguages: string[];
  frameworks: string[];
  databases: string[];
  cloud: string[];
  aiTechnologies: string[];
  systemDesignLevel: string;
  codingLevel: string;
  confirmedSkills: string[];
  confirmedProjects: string[];
  preferences: UserPreferences;
  onboardingCompleted: boolean;
  curriculumGenerated: boolean;
}

// Question types
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
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

export interface Question {
  id: string;
  question: string;
  topic: string;
  subtopic: string;
  concepts: string[];
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  archetype: string;
  interviewPriority: string;
  resumeRelevance: string;
  expectedAnswerDepth: 'SHORT' | 'MODERATE' | 'DEEP';
  estimatedAnswerTimeSeconds: number;
  followUpConcepts: string[];
  tags: string[];
  provenance: string;
  isSystemDesign: boolean;
  isCoding: boolean;
  isProjectInterview: boolean;
  shortAnswer?: string;
  detailedAnswer?: string;
}

// Session types
export interface Session {
  sessionId: string;
  sessionDate: string;
  userDayNumber: number;
  status: 'pending' | 'in_progress' | 'completed' | 'paused' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  totalTimeSeconds?: number;
  totalQuestions: number;
  completedQuestions: number;
  averageScore: number;
  sections: SessionSection[];
  topicSelectionRationale?: TopicSelectionRationale;
}

export interface SessionSection {
  id: string;
  type: 'technical' | 'system_design' | 'coding' | 'project' | 'revision';
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  totalQuestions: number;
  completedQuestions: number;
  topic: string;
  subtopic?: string;
  questions: SessionQuestion[];
}

export interface SessionQuestion {
  id: string;
  order: number;
  status: 'pending' | 'presented' | 'answered' | 'skipped' | 'bookmarked' | 'flagged';
  question: string;
  topic: string;
  subtopic: string;
  concepts: string[];
  difficulty: string;
  questionType: string;
  archetype: string;
  interviewPriority: string;
  estimatedTimeSeconds: number;
  isSystemDesign: boolean;
  isCoding: boolean;
  isProjectInterview: boolean;
  isRevision: boolean;
  revisionNumber?: number;
  answer?: string;
  answerTimeSeconds?: number;
  finalScore?: number;
  userNotes?: string;
  bookmarked: boolean;
  flagged: boolean;
  evaluation?: AnswerEvaluation;
}

export interface AnswerEvaluation {
  overallScore: number;
  technicalCorrectness: number;
  completeness: number;
  depth: number;
  clarity: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missingPoints: string[];
  improvementSuggestions: string[];
  keyConceptsToRevise: string[];
}

export interface TopicSelectionRationale {
  selectedTopic: string;
  reason: string;
  resumeRelevance: boolean;
  weakArea: boolean;
  marketRelevance: boolean;
  coverageGap: boolean;
}

// Revision types
export interface Revision {
  id: string;
  dueDate: string;
  revisionNumber: number;
  status: 'pending' | 'due' | 'in_progress' | 'completed' | 'failed';
  question: string;
  topic: string;
  subtopic: string;
  concepts: string[];
  difficulty: string;
  originalAnswer?: string;
  originalAnswerDate?: string;
  originalScore?: number;
  currentAnswer?: string;
  currentScore?: number;
  isMastered: boolean;
  masteryProgress: number;
  currentEvaluation?: {
    overallScore: number;
    improved: boolean;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    improvementSuggestions: string[];
  };
}

// Project types
export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  role: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  totalQuestionsAsked: number;
  interviewTree?: ProjectInterviewTree;
}

export interface ProjectInterviewTree {
  motivation?: {
    whyBuilt: string;
    problemSolved: string;
  };
  architecture?: {
    highLevelDesign: string;
    components: string[];
  };
  technologyChoices?: {
    whyChosen: string[];
  };
  scalability?: {
    scalingApproach: string[];
  };
  security?: {
    authentication: string;
  };
}

// Coding types
export interface CodingProblem {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  pattern: string[];
  platform: string;
  url?: string;
  description: string;
  tags: string[];
}

export interface CodingHistory {
  id: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  pattern: string[];
  status: 'not_started' | 'attempted' | 'solved' | 'skipped';
  attempts: number;
  isCorrect?: boolean;
  timeSpentSeconds?: number;
  selfRating?: number;
}

// Mock Interview types
export interface MockInterview {
  id: string;
  type: string;
  title?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'abandoned';
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  totalQuestions: number;
  answeredQuestions: number;
  averageScore?: number;
  weakAreas: string[];
  strongAreas: string[];
  overallFeedback?: string;
  summary?: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  userRating?: number;
}

// Analytics types
export interface Analytics {
  totalQuestions: number;
  answeredQuestions: number;
  averageScore: number;
  totalStudyTimeSeconds: number;
  currentStreak: number;
  longestStreak: number;
  daysActive: number;
  completionRate: number;
  masteredSkills: number;
  weakSkills: number;
  topicProgress: TopicProgress[];
  difficultyProgress: DifficultyProgress[];
  questionTypeProgress: QuestionTypeProgress[];
  codingProgress: CodingProgress;
  systemDesignProgress: SystemDesignProgress;
  projectProgress: ProjectProgress;
  revisionProgress: RevisionProgress;
  mockInterviewProgress: MockInterviewProgress;
}

export interface TopicProgress {
  topic: string;
  questions: number;
  answered: number;
  averageScore: number;
  mastery: number;
  weak: boolean;
  mastered: boolean;
}

export interface DifficultyProgress {
  difficulty: string;
  questions: number;
  answered: number;
  averageScore: number;
}

export interface QuestionTypeProgress {
  questionType: string;
  questions: number;
  answered: number;
  averageScore: number;
}

export interface CodingProgress {
  totalProblems: number;
  solvedProblems: number;
  attemptedProblems: number;
  patternsProgress: PatternProgress[];
}

export interface PatternProgress {
  pattern: string;
  total: number;
  solved: number;
  attempted: number;
  completionRate: number;
}

export interface SystemDesignProgress {
  totalQuestions: number;
  answeredQuestions: number;
  averageScore: number;
}

export interface ProjectProgress {
  totalProjects: number;
  totalProjectQuestions: number;
  averageProjectScore: number;
  projectsWithInterviewPrep: number;
}

export interface RevisionProgress {
  totalRevisions: number;
  dueRevisions: number;
  completedRevisions: number;
  masteredRevisions: number;
  averageRevisionScore: number;
}

export interface MockInterviewProgress {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number;
}

// Web search types
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface SynthesizedAnswer {
  summary: string;
  keyPoints: string[];
  caveats: string[];
  confidence: number;
  basedOn: string[];
  generatedBy: 'ai' | 'heuristic';
  generatedAt: string;
}

export interface WebSearchResponse {
  query: string;
  provider: string;
  cached: boolean;
  fetchedAt: string;
  results: WebSearchResult[];
  answer?: SynthesizedAnswer;
}

export interface RecentSearch {
  query: string;
  provider: string;
  fetchedAt: string;
  resultCount: number;
  hasAnswer: boolean;
  usageCount: number;
}

// Past questions / performance history
export interface PastQuestionEntry {
  id: string;
  type: string;
  title: string;
  topic?: string;
  difficulty?: string;
  status: string;
  knewAnswer?: boolean;
  score?: number;
  answer?: string;
  /** Lets the history page fetch or generate this question's answer. */
  questionId?: string;
  occurredAt: string;
}

export interface PastQuestionDay {
  date: string;
  sessionDayNumber?: number;
  sessionStatus?: string;
  questions: number;
  answered: number;
  known: number;
  averageScore: number | null;
  performanceScore: number;
  entries: PastQuestionEntry[];
}

// Calendar types
export interface DailyTotals {
  questions: number;
  answered: number;
  skipped: number;
  correct: number;
  searches: number;
  byType: Record<string, number>;
}

export interface CalendarDay {
  date: string;
  totals: DailyTotals;
  averageScore?: number;
  sessionDayNumber?: number;
  sessionStatus?: string;
  hasActivity: boolean;
  notes?: string;
}

export interface CalendarMonthOverview {
  year: number;
  month: number;
  days: CalendarDay[];
}

export interface DailyRecordEntry {
  id: string;
  type: 'technical' | 'system_design' | 'coding' | 'project' | 'revision' | 'mock_interview' | 'behavioral' | 'search' | 'custom';
  title: string;
  topic?: string;
  subtopic?: string;
  concepts?: string[];
  difficulty?: string;
  status: 'pending' | 'presented' | 'answered' | 'skipped' | 'completed' | 'failed';
  score?: number;
  answer?: string;
  sourceUrls?: string[];
  count?: number;
  /** questionId lets the calendar fetch/generate the answer for this question. */
  metadata?: { questionId?: string; source?: string; [key: string]: unknown };
  occurredAt: string;
}

export interface DailyRecord {
  id: string;
  date: string;
  dateKey: string;
  entries: DailyRecordEntry[];
  totals: DailyTotals;
  averageScore?: number;
  sessionDayNumber?: number;
  sessionStatus?: string;
  notes?: string;
}
