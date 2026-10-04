import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDailyTrackerEntry extends Document {
  userId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  dateKey: string;
  target: number;
  actual: number;
  completed: boolean;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dailyTrackerEntrySchema = new Schema<IDailyTrackerEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'TrackerTask', required: true },
  dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  target: { type: Number, required: true, min: 0 },
  actual: { type: Number, required: true, min: 0, default: 0 },
  completed: { type: Boolean, default: false },
  completedAt: Date,
  notes: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

dailyTrackerEntrySchema.index({ userId: 1, taskId: 1, dateKey: 1 }, { unique: true });
dailyTrackerEntrySchema.index({ userId: 1, dateKey: 1 });

const DailyTrackerEntry: Model<IDailyTrackerEntry> = mongoose.models.DailyTrackerEntry || mongoose.model<IDailyTrackerEntry>('DailyTrackerEntry', dailyTrackerEntrySchema);
export default DailyTrackerEntry;
