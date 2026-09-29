import mongoose from 'mongoose';
import config from '../config';
import Resume, { ResumeVersion } from '../modules/resume/resume.model';
import ResumeProfile from '../modules/resume/resume-profile.model';
import InterviewProfile from '../modules/profile/interview-profile.model';
import { DailySession, SessionQuestion } from '../modules/sessions/daily-session.model';
import { QuestionExposure, questionHash } from '../modules/questions/personalized-generator';
import { Session } from '../modules/auth/index.model';
import { hashToken } from '../common/middleware/auth';

// Additive, idempotent backfill. Run with a database backup; no collection deletion.
export async function migrate() {
  for await (const resume of Resume.find().cursor()) {
    await ResumeVersion.updateMany({ _id:{ $in:resume.versions },userId:{ $exists:false } },{ $set:{userId:resume.userId} });
  }
  // Old sample extraction must never become trusted automatically.
  const legacySamples=await ResumeProfile.find({fullName:'Sample Candidate',email:'sample@example.com'}).select('_id').lean();
  await InterviewProfile.updateMany({resumeProfileId:{$in:legacySamples.map(p=>p._id)}},{$set:{onboardingCompleted:false}});
  await ResumeProfile.updateMany({ fullName:'Sample Candidate',email:'sample@example.com' },
    { $set:{ skills:[],experience:[],projects:[],education:[],certifications:[],confidence:0,
      userModified:false,parsingNotes:['Legacy sample extraction removed. Reparse the original file.'] } });
  for await (const session of Session.find().cursor()) {
    if (session.token.includes('.')) {
      await Session.updateOne({ _id:session._id },{ token:hashToken(session.token)
         });
    }
  }
  for await (const daily of DailySession.find().cursor()) {
    const mappings=await SessionQuestion.find({sessionId:daily._id});
    for(const mapping of mappings) {
      if(mapping.isRevision || !mapping.questionSnapshot?.question) continue;
      await QuestionExposure.updateOne({userId:daily.userId,normalizedHash:questionHash(mapping.questionSnapshot.question)},
        {$setOnInsert:{questionId:mapping.questionId,sessionId:daily._id,question:mapping.questionSnapshot.question,
          topic:mapping.questionSnapshot.topic}},{upsert:true});
    }
  }
  await Promise.all([ResumeVersion.createIndexes(),QuestionExposure.createIndexes()]);
}
if(require.main===module) {
  mongoose.connect(config.database.uri).then(migrate).then(()=>mongoose.disconnect()).catch(async()=>{
    console.error('Migration failed. Inspect database connectivity and indexes; records were not deleted.');
    await mongoose.disconnect();process.exitCode=1;
  });
}
