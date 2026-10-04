import mongoose, { Document, Model, Schema } from 'mongoose';

export const TRACKER_UNITS = ['count', 'questions', 'problems', 'minutes', 'hours', 'session', 'boolean'] as const;
export const TRACKER_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

export interface ITrackerTask extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category?: string;
  targetValue: number;
  unit: typeof TRACKER_UNITS[number];
  frequency: typeof TRACKER_FREQUENCIES[number];
  active: boolean;
  order: number;
  systemKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const trackerTaskSchema = new Schema<ITrackerTask>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  category: { type: String, trim: true, maxlength: 60 },
  targetValue: { type: Number, required: true, min: 0.01, default: 1 },
  unit: { type: String, enum: TRACKER_UNITS, required: true, default: 'count' },
  frequency: { type: String, enum: TRACKER_FREQUENCIES, required: true, default: 'daily' },
  active: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 0 },
  systemKey: { type: String, trim: true },
}, { timestamps: true });

trackerTaskSchema.index({ userId: 1, order: 1, createdAt: 1 });
trackerTaskSchema.index({ userId: 1, systemKey: 1 }, { unique: true, partialFilterExpression: { systemKey: { $exists: true } } });

const TrackerTask: Model<ITrackerTask> = mongoose.models.TrackerTask || mongoose.model<ITrackerTask>('TrackerTask', trackerTaskSchema);
export default TrackerTask;
