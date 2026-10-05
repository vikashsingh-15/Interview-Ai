import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, BadRequestError, NotFoundError } from '../../common/filters/error-filter';
import Resume, { ResumeVersion } from '../resume/resume.model';
import ResumeProfile from '../resume/resume-profile.model';
import InterviewProfile from './interview-profile.model';
import { buildDailyPlan, planTotal } from './daily-plan';
import SkillGraph from '../skill-graph/skill-graph.model';
import { resumeService } from '../resume/resume.service';
import { skillEntrySchema, experienceEntrySchema, projectEntrySchema } from '../resume/resume-parser';

const router = Router();
router.use(authenticate);
const confirmation = { isConfirmed: z.boolean().default(false), isRemoved: z.boolean().default(false) };
const skill = skillEntrySchema.extend(confirmation);
const entryId = { _id: z.string().regex(/^[a-fA-F0-9]{24}$/).optional() };
const experience = experienceEntrySchema.extend({ ...confirmation, ...entryId });
const project = projectEntrySchema.extend({ ...confirmation, ...entryId });
export const reviewSchema = z.object({
  fullName: z.string().max(200).optional(), currentRole: z.string().max(200).optional(),
  totalExperienceMonths: z.number().int().min(0).max(1200).optional(),
  skills: z.array(skill).max(100), experience: z.array(experience).max(40),
  projects: z.array(project).max(40),
});
export const planSectionSchema = z.object({
  title: z.string().min(1).max(100), topic: z.string().min(1).max(100),
  type: z.enum(['technical','system_design','coding','project','behavioral','custom']),
  count: z.number().int().min(0).max(50),
});
const onboardingSchema = z.object({
  targetRole: z.string().max(150).default(''), targetLevel: z.string().max(100).default(''),
  actualExperienceMonths: z.number().int().min(0).max(1200),
  targetCompanies: z.array(z.string().max(100)).max(20).default([]),
  industries: z.array(z.string().max(100)).max(20).default([]),
  interviewTypes: z.array(z.string().max(100)).max(20).default([]),
  interviewDate: z.string().datetime().optional(),
  difficulty: z.enum(['easy','medium','hard','extra_hard','mixed']).default('mixed'),
  focusTopics: z.array(z.string().max(100)).max(30).default([]),
  excludedTopics: z.array(z.string().max(100)).max(30).default([]),
  codingLanguages: z.array(z.string().max(100)).max(10).default([]),
  dailyPlan: z.array(planSectionSchema).min(1).max(12).optional(),
});

router.get('/onboarding', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const [resume, profile] = await Promise.all([resumeService.getResume(req.user!.id),
    InterviewProfile.findOne({ userId: req.user!.id }).lean()]);
  res.json({ success: true, data: { resume, profile } });
}));
router.put('/review', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = reviewSchema.parse(req.body);
  const resume = await Resume.findOne({ userId: req.user!.id, isDeleted: false, isActive: true });
  if (!resume || !(await ResumeVersion.exists({ _id: resume.currentVersionId, parsed: true })))
    throw new BadRequestError('Upload and parse a resume before reviewing it');
  const profile = await ResumeProfile.findOne({ userId: req.user!.id, resumeVersionId: resume.currentVersionId });
  if (!profile) throw new NotFoundError('Resume profile not found');
  const normalized: { experience: any[]; projects: any[] } = {
    experience: [],
    projects: [],
  };
  for (const kind of ['experience', 'projects'] as const) {
    const allowedIds = new Set(profile[kind].map(e => String(e._id)));
    const seenIds = new Set<string>();
    for (const entry of data[kind]) {
      if (entry._id && (!allowedIds.has(entry._id) || seenIds.has(entry._id)))
        throw new BadRequestError('Resume entry IDs must be unique and belong to this resume');
      const id = entry._id || new mongoose.Types.ObjectId().toString();
      if (seenIds.has(id)) throw new BadRequestError('Resume entry IDs must be unique and belong to this resume');
      seenIds.add(id);
      normalized[kind].push({ ...entry, _id: id });
    }
  }
  Object.assign(profile, data, normalized, { skills: data.skills.map(s => ({ ...s, source: 'user' })),
    userModified: true, modifiedAt: new Date() });
  await profile.save();
  // Reviewed facts invalidate stale personalization until the user confirms settings again.
  await InterviewProfile.updateOne({ userId: req.user!.id }, { onboardingCompleted: false });
  res.json({ success: true, data: profile });
}));
router.post('/onboarding', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = onboardingSchema.parse(req.body);
  const { interviewProfile: profile, resumeProfile: facts } = await resumeService.regenerateInterviewProfile(req.user!.id);
  if (!facts.userModified) throw new BadRequestError('Review the extracted facts first');
  if (!profile.confirmedSkills.length && !profile.confirmedProjects.length && !profile.confirmedExperience.length)
    throw new BadRequestError('Confirm at least one skill, project or work experience');
  // The plan always mirrors all four per-section settings, so every slider has
// a section to act on rather than only the first one planned at onboarding.
  const dailyPlan = data.dailyPlan?.length ? data.dailyPlan : buildDailyPlan({
    preferences: {
      dailyQuestions: profile.preferences?.dailyQuestions ?? 5,
      codingCount: profile.preferences?.codingCount ?? 0,
      systemDesignCount: profile.preferences?.systemDesignCount ?? 0,
      projectQuestions: profile.preferences?.projectQuestions ?? 0,
      codingLanguages: data.codingLanguages,
      focusTopics: data.focusTopics,
      excludedTopics: data.excludedTopics,
      systemDesignFocus: profile.preferences?.systemDesignFocus,
    },
    confirmedSkills: profile.confirmedSkills,
    confirmedProjects: profile.confirmedProjects,
    currentRole: facts.currentRole,
  });
  if (planTotal(dailyPlan) < 1 || planTotal(dailyPlan) > 50)
    throw new BadRequestError('Choose between 1 and 50 fresh questions per day');
  Object.assign(profile, {
    targetRole: data.targetRole.trim() || facts.currentRole || '',
    targetLevel: data.targetLevel.trim(), actualExperienceMonths: data.actualExperienceMonths,
    targetCompanies: data.targetCompanies, industries: data.industries, interviewTypes: data.interviewTypes,
    interviewDate: data.interviewDate ? new Date(data.interviewDate) : undefined, dailyPlan,
    curriculum: [...new Set([...profile.confirmedSkills, ...data.focusTopics])].map(topic => ({
      topic, source: profile.confirmedSkills.includes(topic) ? 'confirmed_resume' : 'user_focus', priority: 1,
    })),
    curriculumGenerated: true, curriculumGeneratedAt: new Date(), curriculumVersion: 'profile-v2',
    onboardingCompleted: true, onboardingCompletedAt: new Date(),
  });
  Object.assign(profile.preferences, {
    difficulty: data.difficulty, focusTopics: data.focusTopics, excludedTopics: data.excludedTopics,
    codingLanguages: data.codingLanguages,
    dailyQuestions: dailyPlan.filter(s => !['project','coding','system_design'].includes(s.type)).reduce((n,s) => n+s.count,0),
    codingCount: dailyPlan.filter(s => s.type === 'coding').reduce((n,s) => n+s.count,0),
    systemDesignCount: dailyPlan.filter(s => s.type === 'system_design').reduce((n,s) => n+s.count,0),
    projectQuestions: dailyPlan.filter(s => s.type === 'project').reduce((n,s) => n+s.count,0),
    systemDesignFocus: profile.preferences?.systemDesignFocus || [],
  });
  await profile.save();
  await SkillGraph.updateOne({ userId: new mongoose.Types.ObjectId(req.user!.id) },
    { $setOnInsert: { skills: {}, topics: {}, concepts: {}, archetypes: {} } }, { upsert: true });
  res.json({ success: true, data: profile });
}));
export default router;
