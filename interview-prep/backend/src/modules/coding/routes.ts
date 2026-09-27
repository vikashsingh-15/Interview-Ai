import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';

const router = Router();

/**
 * Coding problem routes.
 *
 * The coding model is registered by other modules; accessed via
 * mongoose.model() to avoid a circular import.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const CodingProblem = mongoose.model('CodingProblem');
    const { difficulty, pattern, limit } = req.query as any;

    const filter: Record<string, any> = { isHidden: false, isDeprecated: false };
    if (difficulty) filter.difficulty = difficulty;
    if (pattern) filter.pattern = pattern;

    const problems = await CodingProblem.find(filter)
      .sort({ frequency: -1, title: 1 })
      .limit(Math.min(Number(limit) || 20, 100))
      .select('-solutionCode')
      .lean();

    res.json({ success: true, data: problems });
  })
);

export default router;
