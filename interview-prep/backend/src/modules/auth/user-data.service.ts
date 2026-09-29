import mongoose from 'mongoose';
import Resume, { ResumeVersion } from '../resume/resume.model';
import { DailySession, SessionQuestion } from '../sessions/daily-session.model';
import { Question } from '../questions/question.model';
import { resumeStorage } from '../../common/services/resume-storage';

export async function deleteUserData(userId:string) {
  // Exact owner boundaries; no collection/database deletion or filesystem recursion.
  const resumes=await Resume.find({userId});
  const ids=resumes.flatMap(r=>r.versions);
  const versions=await ResumeVersion.find({_id:{$in:ids}});
  for(const version of versions) await resumeStorage.delete(version.storageKey,version.storageProvider || 'local');
  await ResumeVersion.deleteMany({_id:{$in:ids}});
  const sessions=await DailySession.find({userId}).select('_id').lean();
  await SessionQuestion.deleteMany({sessionId:{$in:sessions.map(s=>s._id)}});
  await Question.deleteMany({ownerUserId:userId});
  for(const model of Object.values(mongoose.models)) {
    if(model.modelName === 'User' || !model.schema.path('userId')) continue;
    await model.deleteMany({userId});
  }
  if(mongoose.models.OAuthState) await mongoose.models.OAuthState.deleteMany({linkUserId:userId});
}
