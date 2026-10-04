import mongoose from 'mongoose';
import ResumeProfile from '../resume/resume-profile.model';
import Project from '../projects/project.model';
import { NotFoundError, ValidationError } from '../../common/filters/error-filter';

export type PracticeSourceRef = { kind: 'project' | 'experience'; id: string };
export type PracticeSource = PracticeSourceRef & {
  label: string; resumeProfileId?: mongoose.Types.ObjectId; facts: Record<string, unknown>;
};

/** Resolve facts on the server, never from a caller-supplied prompt. */
export async function loadPracticeSource(userId: string, ref: PracticeSourceRef): Promise<PracticeSource> {
  if (!mongoose.Types.ObjectId.isValid(ref.id)) throw new ValidationError('Invalid practice source id');
  if (ref.kind === 'project') {
    const p = await Project.findOne({ _id: ref.id, userId, isHidden: false }).lean();
    if (!p) throw new NotFoundError('Project not found');
    return { ...ref, label: p.name, resumeProfileId: p.resumeProfileId, facts: {
      name: p.name, description: p.description, role: p.role, contribution: p.myContribution,
      technologies: p.technologies, architecture: p.architectureDescription,
      architectureType: p.architectureType, decisions: p.keyDesignDecisions,
      alternatives: p.tradeOffsConsidered, features: p.features, featureDetails: p.featuresDescription,
      performanceClaims: p.performanceClaims, scaleClaims: p.scaleClaims,
      securityClaims: p.securityClaims, reliabilityClaims: p.reliabilityClaims,
      metrics: p.metrics, interviewTree: p.interviewTree,
    } };
  }
  if (ref.kind !== 'experience') throw new ValidationError('Invalid practice source');
  const profile = await ResumeProfile.findOne({ userId, experience: {
    $elemMatch: { _id: new mongoose.Types.ObjectId(ref.id), isRemoved: { $ne: true } },
  } }).lean();
  const e = profile?.experience.find(entry => String(entry._id) === ref.id && !entry.isRemoved);
  if (!profile || !e) throw new NotFoundError('Experience not found');
  if (!e.isConfirmed) throw new ValidationError('Confirm this experience in resume review before practicing');
  const relatedProjects = profile.projects.filter(p => !p.isRemoved && p.isConfirmed && e.projectReferences.includes(p.name));
  return { ...ref, label: `${e.company} — ${e.role}`, resumeProfileId: profile._id, facts: {
    company: e.company, role: e.role, startDate: e.startDate, endDate: e.endDate,
    currentRole: e.currentRole, totalMonths: e.totalMonths, technologies: e.technologies,
    responsibilities: e.responsibilities, achievements: e.achievements,
    technicalClaims: e.technicalClaims, projectReferences: e.projectReferences,
    relatedProjects: relatedProjects.map(p => ({ name: p.name, description: p.description,
      technologies: p.technologies, responsibilities: p.responsibilities,
      architectureClaims: p.architectureClaims, technicalDecisions: p.technicalDecisions })),
  } };
}

export async function listExperience(userId: string) {
  const profiles = await ResumeProfile.find({ userId }).sort({ updatedAt: -1 }).select('experience').lean();
  return profiles.flatMap(p => p.experience.filter(e => !e.isRemoved).map(e => ({
    ...e, resumeProfileId: String(p._id), _id: String(e._id),
  })));
}

/** Literal evidence quotes make unsupported claims rejectable before persistence. */
export function sourceEvidence(facts: Record<string, unknown>): string[] {
  const strings: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) strings.push(value.trim());
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object' && !(value instanceof Date)) Object.values(value).forEach(visit);
  };
  visit(facts);
  return [...new Set(strings)];
}
