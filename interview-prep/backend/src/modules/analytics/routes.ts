import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';

const router = Router();
router.get('/topics', authenticate, asyncHandler(async (req:AuthenticatedRequest,res)=>{
  const userId=new mongoose.Types.ObjectId(req.user!.id);
  const QuestionHistory=mongoose.model('QuestionHistory');
  const rows=await QuestionHistory.aggregate([
    {$match:{userId,answerSubmittedAt:{$type:'date'},finalScore:{$type:'number'}}},
    {$sort:{answerSubmittedAt:-1}},
    {$group:{_id:'$questionSnapshot.topic',count:{$sum:1},average:{$avg:'$finalScore'},recent:{$push:{score:'$finalScore',date:'$answerSubmittedAt'}}}},
    {$project:{count:1,average:1,recent:{$slice:['$recent',5]}}},{$sort:{count:-1}},{$limit:50},
  ]);
  res.json({success:true,data:rows});
}));

async function getPracticeStreak(userId: mongoose.Types.ObjectId): Promise<number> {
  const QuestionHistory = mongoose.model('QuestionHistory');
  const answeredDays = await QuestionHistory.aggregate([
    { $match: { userId, answerSubmittedAt: { $type: 'date' } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$answerSubmittedAt', timezone: 'UTC' } } } },
    { $sort: { _id: -1 } },
    { $limit: 367 },
  ]);
  const activeDayKeys = new Set(answeredDays.map((row: { _id: string }) => row._id));
  const today = new Date();
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const todayKey = day.toISOString().slice(0, 10);

  // Keep an unbroken streak alive through today until the day ends; otherwise
  // start counting from yesterday and let a missed full day break the streak.
  if (!activeDayKeys.has(todayKey)) day.setUTCDate(day.getUTCDate() - 1);

  let streak = 0;
  while (activeDayKeys.has(day.toISOString().slice(0, 10))) {
    streak += 1;
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return streak;
}

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

    const [progress, recentRecords, currentStreak] = await Promise.all([
      UserProgress.findOne({ userId }).lean(),
      DailyRecord.find({ userId }).sort({ date: -1 }).limit(30).lean(),
      getPracticeStreak(userId),
    ]);

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
