import mongoose, { Schema, Model, Document } from 'mongoose';

/**
 * DailyRecord
 * -----------
 * One document per user per UTC day: a calendar-style rollup of every
 * interview, system design, coding and project question the user saw, plus
 * ad-hoc web searches. Embedded entries are denormalized snapshots so the
 * record is self-contained even if questions/projects are later modified.
 *
 * Updated in two ways:
 *  - incrementally via recordQuestionInDailyCalendar() from services
 *  - recomputed/repaired via backfillForUser() (admin/script or API)
 */

export type DailyRecordEntryType =
  | 'technical'
  | 'system_design'
  | 'coding'
  | 'project'
  | 'revision'
  | 'mock_interview'
  | 'behavioral'
  | 'search'
  | 'custom';

export interface IDailyRecordEntry {
  _id?: mongoose.Types.ObjectId;
  type: DailyRecordEntryType;
  /** Question text, problem title or search query */
  title: string;
  topic?: string;
  subtopic?: string;
  concepts?: string[];
  difficulty?: string;
  status: 'pending' | 'presented' | 'answered' | 'skipped' | 'completed' | 'failed';
  /** User clicked "I already knew this" — counts as answered with a perfect score */
  knewAnswer?: boolean;
  score?: number;
  answer?: string;
  sourceUrls?: string[];
  count?: number;
  metadata?: Record<string, any>;
  occurredAt: Date;
}

export interface IDailyRecord {
  _id: mongoose.Types.ObjectId;

  userId: mongoose.Types.ObjectId;

  /** Which resume profile this record belongs to (if any) */
  resumeProfileId?: mongoose.Types.ObjectId;

  /** Midnight UTC of the day this record covers */
  date: Date;
  /** e.g. 2026-09-27 (UTC) — unique per user */
  dateKey: string;

  entries: IDailyRecordEntry[];

  totals: {
    questions: number;
    answered: number;
    skipped: number;
    correct: number;
    searches: number;
    byType: Record<string, number>;
  };

  averageScore?: number;
  totalTimeSeconds?: number;

  /** DailySession rollup when one exists for this day */
  sessionRef?: mongoose.Types.ObjectId;
  sessionDayNumber?: number;
  sessionStatus?: string;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface IDailyRecordDocument extends IDailyRecord, Document {}

// Statics interface so mongoose exposes the custom helpers on the model type
export interface IDailyRecordModel extends Model<IDailyRecordDocument> {
  getDateKey(d: Date): string;
  startOfUtcDay(d: Date): Date;
  findOrCreateForDate(
    userId: mongoose.Types.ObjectId,
    date: Date
  ): Promise<{ record: IDailyRecordDocument; created: boolean }>;
}

const entrySchema = new Schema<IDailyRecordEntry>(
  {
    _id: { type: Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    type: {
      type: String,
      enum: [
        'technical', 'system_design', 'coding', 'project', 'revision',
        'mock_interview', 'behavioral', 'search', 'custom',
      ],
      required: true,
    },
    title: { type: String, required: true },
    topic: String,
    subtopic: String,
    concepts: [String],
    difficulty: String,
  status: {
    type: String,
    enum: ['pending', 'presented', 'answered', 'skipped', 'completed', 'failed'],
    default: 'pending',
  },
  /** User clicked "I already knew this" — counts as answered with a perfect score */
  knewAnswer: { type: Boolean, default: false },
    score: Number,
    answer: String,
    sourceUrls: [String],
    count: Number,
    metadata: Schema.Types.Mixed,
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const dailyRecordSchema = new Schema<IDailyRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resumeProfileId: { type: Schema.Types.ObjectId, ref: 'ResumeProfile' },
    date: { type: Date, required: true },
    dateKey: { type: String, required: true },

    entries: { type: [entrySchema], default: [] },

    totals: {
      questions: { type: Number, default: 0 },
      answered: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      searches: { type: Number, default: 0 },
      byType: { type: Schema.Types.Mixed, default: {} },
    },

    averageScore: Number,
    totalTimeSeconds: Number,

    sessionRef: { type: Schema.Types.ObjectId, ref: 'DailySession' },
    sessionDayNumber: Number,
    sessionStatus: String,

    notes: String,
  },
  { timestamps: true }
);

// One record per user per day
dailyRecordSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
dailyRecordSchema.index({ userId: 1, date: -1 });
dailyRecordSchema.index({ userId: 1, 'entries.type': 1 });

dailyRecordSchema.statics.getDateKey = function (d: Date): string {
  return d.toISOString().slice(0, 10);
};

dailyRecordSchema.statics.startOfUtcDay = function (d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

dailyRecordSchema.statics.findOrCreateForDate = async function (this: any,
  userId: mongoose.Types.ObjectId,
  date: Date
) {
  const dateKey = this.getDateKey(date);
  let record = await this.findOne({ userId, dateKey });
  if (record) return { record, created: false };

  try {
    record = await this.create({
      userId,
      date: this.startOfUtcDay(date),
      dateKey,
      entries: [],
      totals: { questions: 0, answered: 0, skipped: 0, correct: 0, searches: 0, byType: {} },
    });
    return { record, created: true };
  } catch (err: any) {
    // Concurrent creation — fetch the winner
    if (err && err.code === 11000) {
      record = await this.findOne({ userId, dateKey });
      if (record) return { record, created: false };
    }
    throw err;
  }
};

const DailyRecord: IDailyRecordModel = mongoose.model<IDailyRecordDocument, IDailyRecordModel>(
  'DailyRecord',
  dailyRecordSchema as any
);

export { DailyRecord };
export default DailyRecord;
