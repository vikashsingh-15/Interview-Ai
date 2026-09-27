import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';

const router = Router();

/**
 * Project routes.
 *
 * The project model is registered by other modules; accessed via
 * mongoose.model() to avoid a circular import.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const Project = mongoose.model('Project');
    const projects = await Project.find({
      userId: new mongoose.Types.ObjectId(req.user.id),
      isHidden: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: projects });
  })
);

export default router;
