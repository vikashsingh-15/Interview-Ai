// Auth models
export { default as User } from '../../auth/user.model';
export { UserModel, Session } from '../../auth/index.model';
export type { IUser, IUserDocument, ISession, ISessionDocument } from '../../auth/index.model';

// Resume models
export { default as Resume, Resume as ResumeModel, ResumeVersion } from '../../resume/resume.model';
export type { IResume, IResumeDocument, IResumeVersion, IResumeVersionDocument } from '../../resume/resume.model';
export { ResumeProfile } from '../../resume/resume-profile.model';
export type { IResumeProfile, IResumeProfileDocument, IExtractedSkill, IExperience, IProject as IResumeProject, IEducation, ICertification } from '../../resume/resume-profile.model';

// Profile models
export { InterviewProfile } from '../../profile/interview-profile.model';
export type { IInterviewProfile, IInterviewProfileDocument, IInterviewPreferences } from '../../profile/interview-profile.model';
export { PREDEFINED_COMPANIES } from '../../profile/interview-profile.model';

// Skill graph models
export {
  SkillGraph,
  Concept,
  Topic,
  Subtopic,
} from '../../skill-graph/skill-graph.model';
export type {
  ISkillGraph,
  ISkillGraphDocument,
  IConcept,
  IConceptDocument,
  ITopic,
  ITopicDocument,
  ISubtopic,
  ISubtopicDocument,
  ISkillNode,
  ISkillNodeState,
} from '../../skill-graph/skill-graph.model';

// Question models
export { Question } from '../../questions/question.model';
export type {
  IQuestion,
  IQuestionDocument,
  QuestionType,
  Difficulty,
  InterviewPriority,
  ResumeRelevance,
  AnswerDepth,
  Provenance,
  QuestionArchetype,
} from '../../questions/question.model';

export { QuestionHistory } from '../../questions/question-history.model';
export type {
  IQuestionHistory,
  IQuestionHistoryDocument,
  QuestionStatus,
} from '../../questions/question-history.model';

// Session models
export { DailySession, SessionQuestion } from '../../sessions/daily-session.model';
export type {
  IDailySession,
  IDailySessionDocument,
  ISessionSection,
  ISessionQuestion,
  SessionStatus,
  SectionType,
} from '../../sessions/daily-session.model';

// Revision models
export { Revision } from '../../revisions/revision.model';
export type {
  IRevision,
  IRevisionDocument,
  RevisionStatus,
  RevisionPerformance,
} from '../../revisions/revision.model';

// Project models
export { Project } from '../../projects/project.model';
export type {
  IProject,
  IProjectDocument,
  ProjectCategory,
  ProjectStatus,
} from '../../projects/project.model';

// Coding models
export { CodingProblem, CodingHistory } from '../../coding/coding-problem.model';
export type {
  ICodingProblem,
  ICodingProblemDocument,
  ICodingHistory,
  ICodingHistoryDocument,
  ProblemDifficulty,
  ProblemPattern,
  ProblemPlatform,
} from '../../coding/coding-problem.model';

// Mock interview models
export { MockInterview } from '../../mock-interviews/mock-interview.model';
export type {
  IMockInterview,
  IMockInterviewDocument,
  InterviewType,
  InterviewStatus,
} from '../../mock-interviews/mock-interview.model';

// Market calibration models
export { MarketSource, MarketCalibrationProfile } from '../../market-calibration/market-calibration.model';
export type {
  IMarketSource,
  IMarketSourceDocument,
  IMarketCalibrationProfile,
  IMarketCalibrationProfileDocument,
  SourceType,
  InterviewRound,
} from '../../market-calibration/market-calibration.model';

// Analytics models
export { UserProgress } from '../../analytics/progress-analytics.model';
export type {
  IUserProgress,
  IUserProgressDocument,
  AnalyticsPeriod,
  SummaryType,
} from '../../analytics/progress-analytics.model';

// Web search models
export { SearchCache } from '../../web-search/search-cache.model';
export type { ISearchCache, ISearchCacheDocument, ISearchCacheModel } from '../../web-search/search-cache.model';

// Calendar models
export { DailyRecord } from '../../calendar/daily-record.model';
export type {
  IDailyRecord,
  IDailyRecordDocument,
  IDailyRecordEntry,
  IDailyRecordModel,
  DailyRecordEntryType,
} from '../../calendar/daily-record.model';
