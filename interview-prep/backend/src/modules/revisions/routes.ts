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

/**
 * Spaced revision schedule for the user's weak answers.
 *
 * Buckets follow the spaced-repetition plan: due now (includes yesterday's
 * +1-day pass), and the upcoming +7, +14 and +30 day windows. Each entry
 * carries the question and its reference answer so the daily page can reveal
 * the model answer on click without another round trip.
 */
router.get(
  '/schedule',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const Revision = mongoose.model('Revision');
    const Question = mongoose.model('Question');

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const atDay = (days: number) => new Date(now.getTime() + days * dayMs);

    const revisions = await Revision.find({
      userId,
      status: { $in: ['pending', 'due'] },
      dueDate: { $lte: atDay(30) },
    })
      .sort({ dueDate: 1 })
      .limit(60)
      .lean();

    // Reference answers for the reveal UI. Exclude model internals; keep the
    // fields the page renders.
    const questionIds = [...new Set(revisions.map((r) => String(r.originalQuestionId)))];
    const questions = await Question.find({ _id: { $in: questionIds } })
      .select('question detailedAnswer shortAnswer interviewAnswer concepts topic subtopic difficulty')
      .lean();
    const byId = new Map(questions.map((q) => [String(q._id), q]));

    const toEntry = (r: any) => {
      const q = byId.get(String(r.originalQuestionId));
      return {
        revisionId: String(r._id),
        questionId: String(r.originalQuestionId),
        question: r.originalQuestionSnapshot?.question || q?.question || 'Question',
        topic: r.originalQuestionSnapshot?.topic || q?.topic || '',
        subtopic: r.originalQuestionSnapshot?.subtopic || q?.subtopic || '',
        concepts: r.originalQuestionSnapshot?.concepts || q?.concepts || [],
        difficulty: r.originalQuestionSnapshot?.difficulty || q?.difficulty || 'MEDIUM',
        revisionNumber: r.currentRevisionNumber ?? 0,
        originalScore: r.originalScore,
        dueDate: r.dueDate,
        referenceAnswer: q?.detailedAnswer || q?.shortAnswer || '',
      };
    };

    const dueNow = revisions.filter((r: any) => new Date(r.dueDate) <= now).map(toEntry);
    const inBucket = (fromDays: number, toDays: number) =>
      revisions.filter((r: any) => {
        const d = new Date(r.dueDate).getTime();
        return d > now.getTime() + fromDays * dayMs && d <= now.getTime() + toDays * dayMs;
      }).map(toEntry);
    const bucket7 = inBucket(1, 7);
    const bucket14 = inBucket(7, 14);
    const bucket30 = inBucket(14, 30);

    res.json({
      success: true,
      data: {
        dueNow,
        in7Days: bucket7,
        in14Days: bucket14,
        in30Days: bucket30,
        totals: {
          dueNow: dueNow.length,
          in7Days: bucket7.length,
          in14Days: bucket14.length,
          in30Days: bucket30.length,
        },
      },
    });
  })
);

export default router;
