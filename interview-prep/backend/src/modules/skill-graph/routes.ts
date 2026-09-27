import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';

const router = Router();

/**
 * Skill graph routes.
 *
 * The skill-graph model is registered by other modules; accessed via
 * mongoose.model() to avoid a circular import.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const SkillGraph = mongoose.model('SkillGraph');
    const graph = await SkillGraph.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    }).lean();

    res.json({ success: true, data: graph });
  })
);

export default router;
