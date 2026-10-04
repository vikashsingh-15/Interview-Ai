import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPlannerTask extends Document {
  userId: mongoose.Types.ObjectId;
  year: number;
  month: number;
  week: number;
  title: string;
  description?: string;
  category?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  completedAt?: Date;
  order: number;
  carriedFrom?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const plannerTaskSchema = new Schema<IPlannerTask>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  year: { type: Number, required: true, min: 1970, max: 2999 },
  month: { type: Number, required: true, min: 1, max: 12 },
  week: { type: Number, required: true, min: 1, max: 6 },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 1000 },
  category: { type: String, trim: true, maxlength: 60 },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  completed: { type: Boolean, default: false },
  completedAt: Date,
  order: { type: Number, default: 0 },
  carriedFrom: { type: Schema.Types.ObjectId, ref: 'PlannerTask' },
}, { timestamps: true });

plannerTaskSchema.index({ userId: 1, year: 1, month: 1, week: 1, order: 1 });
plannerTaskSchema.index(
  { userId: 1, carriedFrom: 1, year: 1, month: 1, week: 1 },
  { unique: true, partialFilterExpression: { carriedFrom: { $exists: true } } },
);

const PlannerTask: Model<IPlannerTask> = mongoose.models.PlannerTask || mongoose.model<IPlannerTask>('PlannerTask', plannerTaskSchema);
export default PlannerTask;
