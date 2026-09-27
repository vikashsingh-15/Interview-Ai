import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';

const router = Router();

/**
 * Analytics routes.
 *
 * The analytics models are registered by other modules; accessed via
 * mongoose.model() to avoid a circular import.
 */
router.get(
  '/overview',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const UserProgress = mongoose.model('UserProgress');
    const DailyRecord = mongoose.model('DailyRecord');

    const [progress, recentRecords] = await Promise.all([
      UserProgress.findOne({ userId }).lean(),
      DailyRecord.find({ userId }).sort({ date: -1 }).limit(30).lean(),
    ]);

    // Compute a simple current streak from recent daily records
    let currentStreak = 0;
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 0; i < recentRecords.length; i++) {
      const expected = new Date(Date.now() - i * dayMs);
      const recordDate = new Date(recentRecords[i].date);
      if (recordDate.toDateString() === expected.toDateString()) {
        currentStreak += 1;
      } else {
        break;
      }
    }

    res.json({
      success: true,
      data: {
        ...progress,
        currentStreak,
        daysActive: (progress as any)?.daysActive ?? recentRecords.length,
      },
    });
  })
);

export default router;
