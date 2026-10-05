import mongoose from 'mongoose';
import config from '../config';
import Resume from '../modules/resume/resume.model';
import ResumeProfile from '../modules/resume/resume-profile.model';
import { Question } from '../modules/questions/question.model';
import { QuestionHistory } from '../modules/questions/question-history.model';

/** Additive, idempotent legacy backfill. Run against a backed-up database. */
export async function migrateMultiResumeContext(dryRun = process.argv.includes('--dry-run')) {
  const users = await Resume.distinct('userId', { isDeleted: false });
  let changed = 0;
  for (const userId of users) {
    const resumes: any[] = await Resume.find({ userId, isDeleted: false }).sort({ updatedAt: -1 }).lean();
    if (!resumes.length) continue;
    const active = resumes.find(r => r.isActive) || resumes[0];
    if (!dryRun) {
      await Resume.updateMany({ userId, isDeleted: false }, { $set: { isActive: false } });
      await Resume.updateOne({ _id: active._id }, { $set: { isActive: true, name: active.name || 'Resume' } });
    }
    changed += resumes.length;
  }
  // Populate explicit version references for rows that already have a legacy profile reference.
  for await (const q of Question.find({ resumeProfileId: { $exists: true }, $or: [{ resumeVersionId: { $exists: false } }, { resumeId: { $exists: false } }] }).cursor()) {
    const profile: any = await ResumeProfile.findOne({ _id: q.resumeProfileId }).select('userId resumeVersionId').lean();
    if (!profile) continue;
    const resume: any = await Resume.findOne({ userId: profile.userId, versions: profile.resumeVersionId }).select('_id name').lean();
    if (!resume || dryRun) continue;
    await Question.updateOne({ _id: q._id }, { $set: { resumeId: resume._id, resumeVersionId: profile.resumeVersionId, resumeNameSnapshot: resume.name } });
  }
  for await (const h of QuestionHistory.find({ resumeProfileId: { $exists: true }, $or: [{ resumeVersionId: { $exists: false } }, { resumeId: { $exists: false } }] }).cursor()) {
    const profile: any = await ResumeProfile.findOne({ _id: h.resumeProfileId }).select('userId resumeVersionId').lean();
    if (!profile) continue;
    const resume: any = await Resume.findOne({ userId: profile.userId, versions: profile.resumeVersionId }).select('_id name').lean();
    if (!resume || dryRun) continue;
    await QuestionHistory.updateOne({ _id: h._id }, { $set: { resumeId: resume._id, resumeVersionId: profile.resumeVersionId, resumeNameSnapshot: resume.name } });
  }
  console.log(`${dryRun ? 'Would inspect' : 'Processed'} ${changed} resume records`);
}

if (require.main === module) {
  mongoose.connect(config.database.uri).then(() => migrateMultiResumeContext()).then(() => mongoose.disconnect()).catch(async error => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
}
