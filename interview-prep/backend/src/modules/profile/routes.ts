import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '../../common/filters/error-filter';
import logger from '../../config/logger';
import { DifficultyChoice } from './interview-profile.model';

const router = Router();

const VALID_DIFFICULTIES: DifficultyChoice[] = ['easy', 'medium', 'hard', 'extra_hard', 'mixed'];

const PREFERENCE_NUMBER_FIELDS: Array<{
  field: string;
  min: number;
  max: number;
}> = [
  { field: 'dailyQuestions', min: 0, max: 50 },
  { field: 'codingCount', min: 0, max: 10 },
  { field: 'systemDesignCount', min: 0, max: 10 },
  { field: 'projectQuestions', min: 0, max: 10 },
];

/**
 * GET /api/profile/preferences
 * Returns the user's editable preparation preferences (question counts and
 * difficulty choice). Creates a minimal interview profile if none exists yet,
 * so a user can set preferences before uploading a resume.
 */
router.get(
  '/preferences',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const InterviewProfile = mongoose.model('InterviewProfile');
    let profile = await InterviewProfile.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    }).lean();

    if (!profile) {
      // Create a stub profile so preferences can be saved before onboarding
      const created: any = await InterviewProfile.create({
        userId: new mongoose.Types.ObjectId(req.user.id),
        resumeProfileId: new mongoose.Types.ObjectId(),
        preferences: {},
      });
      profile = created.toObject();
    }

    res.json({
      success: true,
      data: {
        preferences: (profile as any).preferences || {},
      },
    });
  })
);

/**
 * PUT /api/profile/preferences
 * Body may contain:
 *   dailyQuestions, codingCount, systemDesignCount, projectQuestions  (numbers)
 *   difficulty: 'easy' | 'medium' | 'hard' | 'extra_hard' | 'mixed'
 * Unknown fields are ignored. Returns the updated preferences.
 */
router.put(
  '/preferences',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const body = req.body || {};
    const update: Record<string, any> = {};

    for (const { field, min, max } of PREFERENCE_NUMBER_FIELDS) {
      const value = body[field];
      if (value === undefined) continue;

      const num = Number(value);
      if (!Number.isInteger(num) || num < min || num > max) {
        throw new ValidationError(`${field} must be an integer between ${min} and ${max}`);
      }
      update[field] = num;
    }

    if (body.difficulty !== undefined) {
      if (!VALID_DIFFICULTIES.includes(body.difficulty)) {
        throw new ValidationError(
          `difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}`
        );
      }
      update.difficulty = body.difficulty;
    }

    if (Object.keys(update).length === 0) {
      throw new ValidationError('No valid preference fields provided');
    }

    const InterviewProfile = mongoose.model('InterviewProfile');

    // Ensure a profile exists (same stub creation as GET)
    const existing = await InterviewProfile.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    });
    const profile =
      existing ||
      (await InterviewProfile.create({
        userId: new mongoose.Types.ObjectId(req.user.id),
        resumeProfileId: new mongoose.Types.ObjectId(),
        preferences: {},
      }));

    for (const [field, value] of Object.entries(update)) {
      profile.preferences[field] = value;
    }
    // Mark subdocument path modified so mongoose persists the change
    // Synchronize the editable counts with the dynamic daily plan.
    if (profile.dailyPlan?.length) {
      const mapping: Record<string,string> = { coding:'codingCount', system_design:'systemDesignCount', project:'projectQuestions' };
      for (const field of ['dailyQuestions','codingCount','systemDesignCount','projectQuestions']) {
        if (update[field] === undefined) continue;
        const sections = profile.dailyPlan.filter(section=>(mapping[section.type] || 'dailyQuestions')===field);
        sections.forEach((section,index)=>{
          section.count=Math.floor(update[field]/sections.length)+(index<update[field]%sections.length?1:0);
        });
      }
      profile.markModified('dailyPlan');
    }
    profile.markModified('preferences');
    await profile.save();

    logger.info('Preferences updated', { userId: req.user.id, update });

    res.json({
      success: true,
      data: { preferences: profile.preferences },
      message: 'Preferences updated. Your next generated session will use them.',
    });
  })
);

/**
 * GET /api/profile/past-questions?limit=&page=
 * Past asked questions grouped by day, with a per-day performance score
 * (answered ratio + average score).
 */
router.get(
  '/past-questions',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10) || 30, 1), 100);
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);

    const DailyRecord = mongoose.model('DailyRecord');

    const records = await DailyRecord.find({
      userId: new mongoose.Types.ObjectId(req.user.id),
      'totals.questions': { $gt: 0 },
    })
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('date dateKey entries totals averageScore sessionDayNumber sessionStatus')
      .lean();

    const days = records.map((record: any) => {
      const entries = (record.entries || []).filter((e: any) => e.type !== 'search');
      const questions = entries.length || record.totals?.questions || 0;
      const answered = entries.filter(
        (e: any) => e.status === 'answered' || e.status === 'completed' || (e as any).knewAnswer
      ).length;
      const known = entries.filter((e: any) => (e as any).knewAnswer).length;
      const scores = entries
        .map((e: any) => (typeof e.score === 'number' ? e.score : undefined))
        .filter((s: any): s is number => typeof s === 'number');
      const averageScore =
        scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;

      return {
        date: record.dateKey,
        sessionDayNumber: record.sessionDayNumber,
        sessionStatus: record.sessionStatus,
        questions,
        answered,
        known,
        averageScore,
        /** 0..100 composite: 70% answer coverage + 30% answer quality */
        performanceScore:
          questions > 0
            ? Math.round(
                (answered / questions) * 70 +
                  (averageScore !== null ? averageScore : 0) * 30
              )
            : 0,
        entries: entries.map((e: any) => ({
          id: e._id,
          type: e.type,
          title: e.title,
          topic: e.topic,
          difficulty: e.difficulty,
          status: e.status,
          knewAnswer: !!(e as any).knewAnswer,
          score: e.score,
          answer: e.answer,
          occurredAt: e.occurredAt,
        })),
      };
    });

    res.json({ success: true, data: { days, page, limit } });
  })
);

/**
 * POST /api/profile/past-questions/mark-known
 * Body: { title, date?, entryId? }
 * Marks a question the user already knew: sets `knewAnswer`, status 'completed'
 * and a perfect score on the matching daily-record entry, then recomputes the
 * day's totals. Used by the "I already knew this" button.
 */
router.post(
  '/past-questions/mark-known',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const { title, date, entryId } = req.body || {};

    if (!title || typeof title !== 'string') {
      throw new ValidationError('title is required');
    }

    const DailyRecord = mongoose.model('DailyRecord');
    const query: Record<string, any> = {
      userId: new mongoose.Types.ObjectId(req.user.id),
    };
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new ValidationError('date must be YYYY-MM-DD');
      }
      query.dateKey = date;
    } else {
      // Search back up to 30 days for the most recent matching entry
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 30);
      query.date = { $gte: since };
    }

    const records = await DailyRecord.find(query).sort({ date: -1 }).limit(30);
    if (records.length === 0) {
      throw new NotFoundError('No daily records found for this question');
    }

    const normalized = title.trim().toLowerCase();

    for (const record of records) {
      const entry = record.entries.find((e: any) => {
        if (e.type === 'search') return false;
        if (entryId && String(e._id) !== String(entryId)) return false;
        return e.title.trim().toLowerCase() === normalized;
      });

      if (entry) {
        (entry as any).knewAnswer = true;
        entry.status = 'completed';
        // Self-reported knowledge is not objective correctness; preserve the measured score.

        // Recompute totals (count correct as one more)
        const totals = record.totals || ({} as any);
        totals.answered =
          (record.entries || []).filter(
            (e: any) => e.status === 'answered' || e.status === 'completed'
          ).length;
        totals.correct =
          (record.entries || []).filter((e: any) => typeof e.score === 'number' && e.score >= 0.7).length;
        const scoreValues = (record.entries || [])
          .map((e: any) => (typeof e.score === 'number' ? e.score : undefined))
          .filter((s: any): s is number => typeof s === 'number');
        record.averageScore =
          scoreValues.length > 0
            ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
            : undefined;

        record.markModified('totals');
        record.markModified('entries');
        await record.save();

        logger.info('Question marked as known', {
          userId: req.user.id,
          dateKey: record.dateKey,
        });

        return res.json({
          success: true,
          data: { date: record.dateKey },
          message: 'Marked as already known',
        });
      }
    }

    throw new NotFoundError('Question not found in your recent daily records');
  })
);

export default router;
