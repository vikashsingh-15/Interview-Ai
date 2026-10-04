import mongoose from 'mongoose';
import logger from '../../config/logger';
import DailyRecord, {
  IDailyRecordDocument,
  IDailyRecordEntry,
  DailyRecordEntryType,
} from './daily-record.model';
import { DailySession, SessionQuestion } from '../sessions/daily-session.model';
import { QuestionHistory } from '../questions/question-history.model';
import { ValidationError } from '../../common/filters/error-filter';

function normalizeQuestionTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Calendar service
 * ----------------
 * Maintains a date-wise record (calendar) of everything a user practiced:
 * daily-session interview questions (technical / system design / coding /
 * project / revision), mock interviews, and ad-hoc web searches.
 *
 * Two write paths:
 *  1. recordQuestionInDailyCalendar() — incremental, called by services when
 *     a question is presented/answered or a search is run.
 *  2. backfillForUser() — rebuilds day records from DailySession history,
 *     useful for existing users after adopting this feature.
 */

function toDailyRecordEntry(
  sq: any,
  occurredAt: Date
): IDailyRecordEntry {
  const snapshot = sq.questionSnapshot || {};
  return {
    _id: new mongoose.Types.ObjectId(),
    type: snapshot.isCoding
      ? 'coding'
      : snapshot.isSystemDesign
        ? 'system_design'
        : snapshot.isProjectInterview
          ? 'project'
          : sq.isRevision
            ? 'revision'
            : 'technical',
    title: snapshot.question || sq.title || 'Question',
    topic: snapshot.isCoding ? 'Coding' : snapshot.topic,
    subtopic: snapshot.subtopic,
    concepts: snapshot.concepts || [],
    difficulty: snapshot.difficulty,
    status: sq.status === 'answered' ? 'answered' : sq.status === 'skipped' ? 'skipped' : 'presented',
    score: sq.finalScore,
    answer: sq.answer ? String(sq.answer).slice(0, 500) : undefined,
    count: 1,
    metadata: {
      ...(sq.questionId ? { questionId: String(sq.questionId) } : {}),
      ...(sq.isRevision ? { revisionNumber: sq.revisionNumber } : {}),
    },
    occurredAt,
  };
}

export const calendarService = {
  /**
   * Record a single question (or search) in the user's calendar for a given
   * date. Safe to call repeatedly — entries are additive.
   */
  async recordEntry(params: {
    userId: string;
    date?: Date;
    type: DailyRecordEntryType;
    title: string;
    topic?: string;
    subtopic?: string;
    concepts?: string[];
    difficulty?: string;
    status?: IDailyRecordEntry['status'];
    score?: number;
    answer?: string;
    sourceUrls?: string[];
    count?: number;
    metadata?: Record<string, any>;
    occurredAt?: Date;
  }): Promise<IDailyRecordDocument> {
    const {
      userId,
      date = new Date(),
      type,
      title,
      status = 'presented',
      count = 1,
      ...rest
    } = params;

    if (!title || !title.trim()) {
      throw new ValidationError('Entry title is required');
    }

    const { record } = await DailyRecord.findOrCreateForDate(
      new mongoose.Types.ObjectId(userId),
      date
    );

    const entry: IDailyRecordEntry = {
      _id: new mongoose.Types.ObjectId(),
      type,
      title: title.trim().slice(0, 1000),
      status,
      count,
      occurredAt: params.occurredAt || new Date(),
      ...rest,
      ...(params.answer ? { answer: params.answer.slice(0, 500) } : {}),
    };

    record.entries.push(entry);

    // Recompute totals to keep them consistent
    recomputeTotals(record);
    await record.save();

    return record;
  },

  /**
   * Mark an already-recorded (presented) entry as answered, updating it in
   * place instead of appending a duplicate. Falls back to null when no
   * matching entry exists for the day, so callers can append instead.
   */
  async markEntryAnswered(params: {
    userId: string;
    title: string;
    questionId?: string;
    date?: Date;
    score?: number;
    answer?: string;
  }): Promise<IDailyRecordDocument | null> {
    const { userId, title, questionId, date = new Date(), score, answer } = params;

    if (!title || !title.trim()) {
      throw new ValidationError('Entry title is required');
    }

    const { record } = await DailyRecord.findOrCreateForDate(
      new mongoose.Types.ObjectId(userId),
      date
    );

    const normalized = title.trim().toLowerCase();
    const entry = record.entries.find(
      (e) => e.type !== 'search' && e.title.trim().toLowerCase() === normalized
    );

    if (!entry) {
      return null;
    }

    entry.status = 'answered';
    if (questionId) entry.metadata = { ...(entry.metadata || {}), questionId };
    if (typeof score === 'number') entry.score = score;
    if (answer) entry.answer = answer.slice(0, 500);

    recomputeTotals(record);
    await record.save();
    return record;
  },

  /** Get a single day's record; optionally generate an empty one. */
  async getDayRecord(
    userId: string,
    date: Date,
    options: { createIfMissing?: boolean } = {}
  ): Promise<IDailyRecordDocument | null> {
    if (options.createIfMissing) {
      const { record } = await DailyRecord.findOrCreateForDate(
        new mongoose.Types.ObjectId(userId),
        date
      );
      return record;
    }
    const record = await DailyRecord.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      dateKey: DailyRecord.getDateKey(date),
    });
    if (record) {
      const ids = await resolveQuestionIdsForRecords(userId, [record]);
      for (const entry of record.entries) {
        const key = `${record.dateKey}:${normalizeQuestionTitle(entry.title)}`;
        const questionId = ids.get(key);
        if (questionId && !entry.metadata?.questionId) {
          entry.metadata = { ...(entry.metadata || {}), questionId };
        }
      }
    }
    return record;
  },

  /** Calendar cells for a month: date, totals and status per day. */
  async getMonthOverview(userId: string, year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const records = await DailyRecord.find({
      userId: new mongoose.Types.ObjectId(userId),
      date: { $gte: start, $lt: end },
    })
      .sort({ date: 1 })
      .select('date dateKey totals averageScore sessionDayNumber sessionStatus notes')
      .lean();

    return {
      year,
      month,
      days: records.map((r: any) => ({
        date: r.dateKey,
        totals: r.totals,
        averageScore: r.averageScore,
        sessionDayNumber: r.sessionDayNumber,
        sessionStatus: r.sessionStatus,
        hasActivity: (r.totals?.questions || 0) + (r.totals?.searches || 0) > 0,
        notes: r.notes,
      })),
    };
  },

  /** Detailed records for an inclusive date range. */
  async getRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    if (startDate > endDate) {
      throw new ValidationError('startDate must be before endDate');
    }

    // Normalize to UTC day boundaries
    const start = DailyRecord.startOfUtcDay(startDate);
    const end = DailyRecord.startOfUtcDay(endDate);
    end.setUTCDate(end.getUTCDate() + 1); // inclusive end

    return DailyRecord.find({
      userId: new mongoose.Types.ObjectId(userId),
      date: { $gte: start, $lt: end },
    })
      .sort({ date: 1 })
      .lean();
  },

  /** Backfill day records from the user's existing DailySession history. */
  async backfillForUser(userId: string): Promise<{
    daysProcessed: number;
    entriesCreated: number;
  }> {
    const sessions = await DailySession.find({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    })
      .sort({ sessionDate: 1 })
      .populate({ path: 'sections.questions', model: 'SessionQuestion' })
      .lean();

    let entriesCreated = 0;

    for (const session of sessions) {
      const sessionDate = new Date(session.sessionDate);
      const { record } = await DailyRecord.findOrCreateForDate(
        new mongoose.Types.ObjectId(userId),
        sessionDate
      );

      for (const section of session.sections || []) {
        const questions = (section as any).questions || [];

        for (const sq of questions) {
          record.entries.push(toDailyRecordEntry(sq, sessionDate));
          entriesCreated += 1;
        }
      }

      record.sessionRef = session._id as mongoose.Types.ObjectId;
      record.sessionDayNumber = session.userDayNumber;
      record.sessionStatus = session.status;
      recomputeTotals(record);
      await record.save();
    }

    logger.info('Calendar backfill complete', { userId, daysProcessed: sessions.length, entriesCreated });
    return { daysProcessed: sessions.length, entriesCreated };
  },
};

/** Recompute record totals from the entries list. */
export function recomputeTotals(record: IDailyRecordDocument): void {
  const totals = {
    questions: 0,
    answered: 0,
    skipped: 0,
    correct: 0,
    searches: 0,
    byType: {} as Record<string, number>,
  };

  let scoreSum = 0;
  let scoreCount = 0;

  for (const entry of record.entries) {
    if (entry.type === 'search') {
      totals.searches += entry.count || 1;
      continue;
    }

    totals.questions += entry.count || 1;
    totals.byType[entry.type] = (totals.byType[entry.type] || 0) + (entry.count || 1);

    if (entry.status === 'answered' || entry.status === 'completed') totals.answered += 1;
    if (entry.status === 'skipped') totals.skipped += 1;
    if (typeof entry.score === 'number') {
      scoreSum += entry.score;
      scoreCount += 1;
      if (entry.score >= 0.7) totals.correct += 1;
    }
  }

  record.totals = totals;
  record.averageScore = scoreCount > 0 ? scoreSum / scoreCount : undefined;
}

/** Resolve IDs for legacy calendar entries from the user's own daily sessions. */
export async function resolveQuestionIdsForRecords(userId: string, records: Array<{ dateKey: string; entries: Array<{ title: string; type?: string; metadata?: Record<string, any> }> }>) {
  if (!records.length) return new Map<string, string>();
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const dates = records.map(record => new Date(`${record.dateKey}T00:00:00.000Z`).getTime());
  const first = Math.min(...dates), last = Math.max(...dates);
  const sessions = await DailySession.find({
    userId: userObjectId,
    sessionDate: { $gte: new Date(first), $lt: new Date(last + 24 * 60 * 60 * 1000) },
    // Legacy sessions may predate this field; only explicitly deleted sessions are excluded.
    isDeleted: { $ne: true },
  }).select('_id sessionDate').lean();
  const byDateAndTitle = new Map<string, string>();
  const sessionDateById = new Map((sessions as any[]).map(session => [String(session._id), new Date(session.sessionDate)]));
  if (sessionDateById.size) {
    // Sections reference Question IDs, while the per-session snapshots live in
    // SessionQuestion. Query that collection directly to recover every legacy
    // calendar entry, including questions that have never been answered.
    const sessionQuestions = await SessionQuestion.find({ sessionId: { $in: [...sessionDateById.keys()] } })
      .select('sessionId questionId questionSnapshot.question').lean();
    for (const question of sessionQuestions as any[]) {
      const sessionDate = sessionDateById.get(String(question.sessionId));
      const title = question.questionSnapshot?.question;
      if (sessionDate && question.questionId && title) {
        const dateKey = DailyRecord.getDateKey(sessionDate);
        byDateAndTitle.set(`${dateKey}:${normalizeQuestionTitle(title)}`, String(question.questionId));
      }
    }
  }
  for (const record of records) for (const entry of record.entries || []) {
    const key = `${record.dateKey}:${normalizeQuestionTitle(entry.title)}`;
    if (!byDateAndTitle.has(key) && entry.metadata?.questionId) byDateAndTitle.set(key, String(entry.metadata.questionId));
  }

  // Some imported/older calendar entries have no matching daily-session mapping.
  // Recover IDs only from this user's own saved question history.
  const unresolved = records.flatMap(record => (record.entries || [])
    .filter(entry => entry.type !== 'search' && !byDateAndTitle.has(`${record.dateKey}:${normalizeQuestionTitle(entry.title)}`))
    .map(entry => ({ dateKey: record.dateKey, title: entry.title, key: `${record.dateKey}:${normalizeQuestionTitle(entry.title)}` })));
  if (unresolved.length) {
    // Match normalized titles in memory so casing and whitespace differences
    // in imported/legacy snapshots do not hide controls in Calendar or History.
    const histories = await QuestionHistory.find({ userId: userObjectId })
      .sort({ updatedAt: -1 }).select('questionId questionSnapshot.question').lean();
    const idByTitle = new Map<string, string>();
    for (const history of histories as any[]) {
      const title = history.questionSnapshot?.question;
      if (title && !idByTitle.has(normalizeQuestionTitle(title))) idByTitle.set(normalizeQuestionTitle(title), String(history.questionId));
    }
    for (const entry of unresolved) {
      const questionId = idByTitle.get(normalizeQuestionTitle(entry.title));
      if (questionId) byDateAndTitle.set(entry.key, questionId);
    }
  }
  return byDateAndTitle;
}

/**
 * Convenience wrapper used by other modules (e.g. web search) to log an entry
 * into the user's daily calendar without importing the full service surface.
 */
export async function recordQuestionInDailyCalendar(
  userId: string,
  entry: {
    type: DailyRecordEntryType;
    title: string;
    topic?: string;
    subtopic?: string;
    concepts?: string[];
    difficulty?: string;
    status?: IDailyRecordEntry['status'];
    score?: number;
    answer?: string;
    sourceUrls?: string[];
    count?: number;
    metadata?: Record<string, any>;
    occurredAt?: Date;
  }
): Promise<void> {
  await calendarService.recordEntry({ userId, ...entry });
}

export default calendarService;
