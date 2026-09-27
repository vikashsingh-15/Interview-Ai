import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '../../common/filters/error-filter';
import { calendarService } from './calendar.service';

const router = Router();

/**
 * GET /api/calendar/month/:year/:month
 * Calendar cells (totals + status per day) for a month. Month is 1-12.
 */
router.get(
  '/month/:year/:month',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);

    if (!Number.isInteger(year) || year < 1970 || year > 2999) {
      throw new ValidationError('Invalid year');
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new ValidationError('Invalid month (1-12)');
    }

    const overview = await calendarService.getMonthOverview(req.user.id, year, month);
    res.json({ success: true, data: overview });
  })
);

/**
 * GET /api/calendar/day/:date  (YYYY-MM-DD, UTC)
 * Full record for one day: every question/search entry.
 */
router.get(
  '/day/:date',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const date = parseDateParam(req.params.date);
    const record = await calendarService.getDayRecord(req.user.id, date);

    if (!record) {
      throw new NotFoundError(`No record found for ${req.params.date}`);
    }

    res.json({ success: true, data: record });
  })
);

/**
 * GET /api/calendar/range?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Detailed records for an inclusive range (max 93 days).
 */
router.get(
  '/range',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const start = parseDateParam(String(req.query.start || ''));
    const end = parseDateParam(String(req.query.end || ''));

    const ms = end.getTime() - start.getTime();
    if (ms < 0) throw new ValidationError('end must be on or after start');
    if (ms > 93 * 24 * 60 * 60 * 1000) {
      throw new ValidationError('Range cannot exceed 93 days');
    }

    const records = await calendarService.getRange(req.user.id, start, end);
    res.json({ success: true, data: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), records } });
  })
);

/**
 * GET /api/calendar/today — convenience endpoint for the current day record.
 */
router.get(
  '/today',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const record = await calendarService.getDayRecord(req.user.id, new Date(), {
      createIfMissing: true,
    });
    res.json({ success: true, data: record });
  })
);

/**
 * POST /api/calendar/backfill
 * Rebuild day records from the user's existing daily-session history.
 */
router.post(
  '/backfill',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const result = await calendarService.backfillForUser(req.user.id);
    res.json({ success: true, data: result, message: 'Calendar backfilled from session history' });
  })
);

// ---- Helpers -------------------------------------------------------------

function parseDateParam(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new ValidationError('Date must be in YYYY-MM-DD format');
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError('Invalid date');
  }
  return d;
}

export default router;
