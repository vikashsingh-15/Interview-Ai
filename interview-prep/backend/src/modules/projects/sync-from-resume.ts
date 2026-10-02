import mongoose from 'mongoose';
import logger from '../../config/logger';
import Project from './project.model';

/**
 * Projects confirmed during resume review become first-class Project records
 * that the projects page and mock interviews use. Idempotent: existing records
 * are updated in place, de-confirmed ones are hidden, never duplicated.
 */
export async function syncProjectsFromResume(userId: string, resumeProfile: any): Promise<number> {
  // Same criteria as interview profile generation: confirmed and not removed.
  const confirmed = (resumeProfile?.projects || []).filter(
    (p: any) => p && p.isConfirmed && !p.isRemoved &&
      typeof p.name === 'string' && p.name.trim(),
  );
  if (!confirmed.length) return 0;
  const confirmedNames = confirmed.map((p: any) => p.name);

  // Hide previously synced projects the user no longer confirms.
  await Project.updateMany(
    { userId: new mongoose.Types.ObjectId(userId), isVerifiedFromResume: true, name: { $nin: confirmedNames } },
    { $set: { isHidden: true } },
  );

  for (const proj of confirmed) {
    const payload: Record<string, unknown> = {
      name: proj.name,
      description: typeof proj.description === 'string' && proj.description.trim()
        ? proj.description : 'Imported from your resume — add details to prepare for project questions.',
      role: String(resumeProfile.currentRole || '').trim() || 'Owner',
      myContribution: Array.isArray(proj.responsibilities) ? proj.responsibilities.join('; ') : '',
      technologies: Array.isArray(proj.technologies) ? proj.technologies : [],
      features: Array.isArray(proj.features) ? proj.features : [],
      keyDesignDecisions: Array.isArray(proj.technicalDecisions) ? proj.technicalDecisions : [],
      performanceClaims: Array.isArray(proj.performanceClaims) ? proj.performanceClaims : [],
      securityClaims: Array.isArray(proj.securityClaims) ? proj.securityClaims : [],
      // Resume metrics are free-text strings; Project.metrics is structured.
      scaleClaims: Array.isArray(proj.metrics) ? proj.metrics : [],
      startDate: proj.startDate ? new Date(proj.startDate) : undefined,
      endDate: proj.endDate ? new Date(proj.endDate) : undefined,
      isCurrent: !proj.endDate,
      resumeProfileId: resumeProfile._id,
      resumeVersionId: resumeProfile.resumeVersionId,
      isVerifiedFromResume: true,
      verifiedAt: new Date(),
    };
    const existing = await Project.findOne({ userId: new mongoose.Types.ObjectId(userId), name: proj.name });
    if (existing) {
      Object.assign(existing, payload, { isHidden: false });
      await existing.save();
    } else {
      const doc = new Project({ userId: new mongoose.Types.ObjectId(userId), ...payload });
      doc.slug = await (doc as any).generateSlug();
      await doc.save();
    }
  }
  logger.info('Synced resume projects to Project records', { userId, count: confirmed.length });
  return confirmed.length;
}
