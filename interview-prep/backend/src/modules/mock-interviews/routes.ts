import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';

const router = Router();

/**
 * Mock interview routes.
 *
 * The mock-interview model is registered by other modules; accessed via
 * mongoose.model() to avoid a circular import.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const MockInterview = mongoose.model('MockInterview');
    const interviews = await MockInterview.find({
      userId: new mongoose.Types.ObjectId(req.user.id),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, data: interviews });
  })
);

export default router;
