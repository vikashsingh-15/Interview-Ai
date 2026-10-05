import mongoose from 'mongoose';
import Resume from './resume.model';
import ResumeProfile from './resume-profile.model';
import { NotFoundError } from '../../common/filters/error-filter';

export async function resolveActiveResumeContext(userId: string) {
  const resume: any = await Resume.findOne({ userId, isActive: true, isDeleted: false }).lean();
  if (!resume?.currentVersionId) return null;
  const profile: any = await ResumeProfile.findOne({ userId, resumeVersionId: resume.currentVersionId }).lean();
  return profile ? { resumeId: resume._id, resumeVersionId: resume.currentVersionId, resumeName: resume.name, profile } : null;
}

export async function resolveStoredResumeContext(userId: string, question: any) {
  if (!question?.resumeVersionId) return resolveActiveResumeContext(userId);
  const versionId = new mongoose.Types.ObjectId(String(question.resumeVersionId));
  const resume: any = await Resume.findOne({ _id: question.resumeId, userId, isDeleted: false, versions: versionId }).lean();
  if (!resume) throw new NotFoundError('Question resume context not found');
  const profile = await ResumeProfile.findOne({ userId, resumeVersionId: versionId }).lean();
  return { resumeId: resume._id, resumeVersionId: versionId, resumeName: question.resumeNameSnapshot || resume.name, profile };
}
