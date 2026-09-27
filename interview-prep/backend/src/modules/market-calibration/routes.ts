import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';

const router = Router();

/**
 * Market calibration routes.
 *
 * The market-calibration models are registered by other modules; accessed via
 * mongoose.model() to avoid a circular import.
 */
router.get(
  '/sources',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const MarketSource = mongoose.model('MarketSource');
    const sources = await MarketSource.find({ isStillValid: true, isArchived: false })
      .sort({ retrievedAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, data: sources });
  })
);

export default router;
