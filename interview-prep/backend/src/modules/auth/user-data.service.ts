import mongoose from 'mongoose';
import Resume, { ResumeVersion } from '../resume/resume.model';
import { DailySession, SessionQuestion } from '../sessions/daily-session.model';
import { Question } from '../questions/question.model';
import { resumeStorage } from '../../common/services/resume-storage';

// These are user activity records. Keep this list explicit so adding a new
// userId model cannot accidentally make a profile, preference, or resume model
// part of a destructive reset.
const ACTIVITY_MODELS = [
  'QuestionHistory',
  'Revision',
  'CodingHistory',
  'MockInterview',
  'UserProgress',
  'DailyRecord',
  'TrackerTask',
  'DailyTrackerEntry',
  'PlannerTask',
  'SkillGraph',
  'SearchCache',
  'AIRequest',
  'QuestionExposure',
  'QuestionGenerationPlan',
] as const;

export async function resetUserPracticeData(userId:string) {
  // Remove session-question join rows before their parent sessions.
  const sessions=await DailySession.find({userId}).select('_id').lean();
  await SessionQuestion.deleteMany({sessionId:{$in:sessions.map(s=>s._id)}});
  await DailySession.deleteMany({userId});

  // Generated questions are private to their owner; curated shared questions
  // remain available after the reset.
  await Question.deleteMany({ownerUserId:userId});

  for(const modelName of ACTIVITY_MODELS) {
    const model=mongoose.models[modelName];
    if(!model?.schema.path('userId')) continue;
    await model.deleteMany({userId});
  }

  // Projects contain resume-derived facts that should remain, but their
  // practice counters and links to deleted question history must be cleared.
  const Project=mongoose.models.Project;
  if(Project) await Project.updateMany({userId},{$set:{totalQuestionsAsked:0,questionHistoryIds:[]},$unset:{lastQuestionDate:1}});

  if(mongoose.models.OAuthState) await mongoose.models.OAuthState.deleteMany({linkUserId:userId});
}

/** Full account deletion removes profile and resume records as well as activity. */
export async function deleteUserData(userId:string) {
  await resetUserPracticeData(userId);

  const resumes=await Resume.find({userId});
  const versionIds=resumes.flatMap(resume=>resume.versions);
  const versions=await ResumeVersion.find({_id:{$in:versionIds}});
  for(const version of versions) await resumeStorage.delete(version.storageKey,version.storageProvider || 'local');
  await ResumeVersion.deleteMany({_id:{$in:versionIds}});

  // Account deletion intentionally removes all remaining owned models. This
  // broad sweep is kept separate from the reset-profile allowlist above.
  for(const model of Object.values(mongoose.models)) {
    if(model.modelName === 'User' || !model.schema.path('userId')) continue;
    await model.deleteMany({userId});
  }
}
