import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';

const router = Router();

/**
 * Question bank routes.
 *
 * The question model is registered by other modules; accessed via
 * mongoose.model() to avoid a circular import.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const Question = mongoose.model('Question');
    const { topic, difficulty, limit } = req.query as any;

    const filter: Record<string, any> = { isHidden: false, isDeprecated: false, qualityStatus: 'approved', 'practiceSource.kind': { $exists: false },
      $or: [{ ownerUserId: { $exists: false }, provenance: 'CURATED' }, { ownerUserId: req.user.id }] };
    if (topic && typeof topic === 'string') {
      if (topic.toLowerCase() === 'coding') filter.isCoding = true;
      else {
        filter.topic = topic;
        filter.isCoding = { $ne: true };
      }
    }
    if (difficulty && typeof difficulty === 'string') filter.difficulty = difficulty;

    const questions = await Question.find(filter)
      .sort({ interviewPriority: -1, usageCount: 1 })
      .limit(Math.max(1, Math.min(Number(limit) || 20, 100)))
      .select('-embedding -detailedAnswer -internalWorking -sourceContext -sourceEvidence')
      .lean();

    res.json({ success: true, data: questions });
  })
);

export default router;
