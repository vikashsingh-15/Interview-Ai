import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';

const router = Router();

/**
 * Revision routes.
 *
 * The revision model is registered by other modules; accessed via
 * mongoose.model() to avoid a circular import.
 */
router.get(
  '/due',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const Revision = mongoose.model('Revision');
    const due = await Revision.find({
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: { $in: ['pending', 'due'] },
      dueDate: { $lte: new Date() },
    })
      .sort({ dueDate: 1 })
      .limit(50)
      .lean();

    res.json({ success: true, data: due });
  })
);

export default router;
