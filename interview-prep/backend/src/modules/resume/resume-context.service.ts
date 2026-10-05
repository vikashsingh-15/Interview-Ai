import mongoose from 'mongoose';
import Resume from './resume.model';
import ResumeProfile from './resume-profile.model';
import { NotFoundError } from '../../common/filters/error-filter';
import InterviewProfile from '../profile/interview-profile.model';

export async function resolveActiveResumeContext(userId: string) {
  const resume: any = await Resume.findOne({ userId, isActive: true, isDeleted: false }).lean();
  if (!resume?.currentVersionId) return null;
  const profile: any = await ResumeProfile.findOne({ userId, resumeVersionId: resume.currentVersionId }).lean();
  return profile ? { resumeId: resume._id, resumeVersionId: resume.currentVersionId, resumeName: resume.name, profile } : null;
}

export async function resolveActiveInterviewProfile(userId: string) {
  const context = await resolveActiveResumeContext(userId);
  if (!context) return null;
  return InterviewProfile.findOne({ userId: new mongoose.Types.ObjectId(userId), resumeProfileId: context.profile._id });
}

export async function resolveStoredResumeContext(userId: string, question: any) {
  let versionId = question?.resumeVersionId ? new mongoose.Types.ObjectId(String(question.resumeVersionId)) : null;
  if (!versionId && question?.resumeProfileId) {
    const legacyProfile: any = await ResumeProfile.findOne({ _id: question.resumeProfileId, userId }).select('resumeVersionId').lean();
    versionId = legacyProfile?.resumeVersionId || null;
  }
  if (!versionId) return resolveActiveResumeContext(userId);
  // Historical answer generation remains valid after a soft-deleted resume.
  // Ownership and version membership are still enforced here.
  const resume: any = await Resume.findOne({ ...(question.resumeId ? { _id: question.resumeId } : {}), userId, versions: versionId }).lean();
  if (!resume) throw new NotFoundError('Question resume context not found');
  const profile = await ResumeProfile.findOne({ userId, resumeVersionId: versionId }).lean();
  return { resumeId: resume._id, resumeVersionId: versionId, resumeName: question.resumeNameSnapshot || resume.name, profile };
}
