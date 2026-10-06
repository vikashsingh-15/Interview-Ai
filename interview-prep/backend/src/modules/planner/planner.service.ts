import mongoose from 'mongoose';
import logger from '../../config/logger';
import { NotFoundError, ValidationError } from '../../common/filters/error-filter';
import PlannerTask from './planner-task.model';

const oid = (value: string) => new mongoose.Types.ObjectId(value);

function validatePeriod(year: number, month: number, week?: number) {
  if (!Number.isInteger(year) || year < 1970 || year > 2999) throw new ValidationError('Invalid year');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new ValidationError('Invalid month (1-12)');
  if (week !== undefined && (!Number.isInteger(week) || week < 1 || week > 6)) throw new ValidationError('Invalid week (1-6)');
}

export const plannerService = {
  async list(userId: string, year: number, month: number) {
    validatePeriod(year, month);
    return PlannerTask.find({ userId: oid(userId), year, month }).sort({ week: 1, order: 1, createdAt: 1 }).lean();
  },

  async create(userId: string, input: Record<string, any>) {
    const year = Number(input.year), month = Number(input.month), week = Number(input.week);
    validatePeriod(year, month, week);
    const title = String(input.title || '').trim();
    if (!title || title.length > 160) throw new ValidationError('A title of at most 160 characters is required');
    if (input.priority !== undefined && !['low', 'medium', 'high'].includes(input.priority)) throw new ValidationError('Invalid priority');
    return PlannerTask.create({
      userId: oid(userId), year, month, week, title,
      description: input.description, category: input.category,
      priority: input.priority || 'medium', order: Number.isInteger(input.order) ? input.order : 0,
    });
  },

  async update(userId: string, taskId: string, input: Record<string, any>) {
    const allowed: Record<string, any> = {};
    for (const key of ['title', 'description', 'category', 'priority', 'order', 'year', 'month', 'week']) {
      if (input[key] !== undefined) allowed[key] = input[key];
    }
    if (allowed.year !== undefined || allowed.month !== undefined || allowed.week !== undefined) {
      const current = await PlannerTask.findOne({ _id: taskId, userId: oid(userId) }).lean();
      if (!current) throw new NotFoundError('Planner task not found');
      validatePeriod(Number(allowed.year ?? current.year), Number(allowed.month ?? current.month), Number(allowed.week ?? current.week));
    }
    if (allowed.title !== undefined) {
      allowed.title = String(allowed.title).trim();
      if (!allowed.title || allowed.title.length > 160) throw new ValidationError('A title of at most 160 characters is required');
    }
    if (allowed.priority !== undefined && !['low', 'medium', 'high'].includes(allowed.priority)) throw new ValidationError('Invalid priority');
    if (allowed.completed !== undefined && typeof allowed.completed !== 'boolean') throw new ValidationError('completed must be a boolean');
    if (input.completed !== undefined) {
      allowed.completed = input.completed;
      if (input.completed) allowed.completedAt = new Date();
    }
    const update: Record<string, any> = { $set: allowed };
    if (input.completed === false) update.$unset = { completedAt: 1 };
    const task = await PlannerTask.findOneAndUpdate({ _id: taskId, userId: oid(userId) }, update, { new: true, runValidators: true });
    if (!task) throw new NotFoundError('Planner task not found');
    return task;
  },

  async remove(userId: string, taskId: string) {
    const task = await PlannerTask.findOneAndDelete({ _id: taskId, userId: oid(userId) });
    if (!task) throw new NotFoundError('Planner task not found');
    return task;
  },

  async carryForward(userId: string, taskId: string, year: number, month: number, week: number) {
    validatePeriod(year, month, week);
    const source = await PlannerTask.findOne({ _id: taskId, userId: oid(userId) }).lean();
    if (!source) throw new NotFoundError('Planner task not found');
    try {
      return await PlannerTask.findOneAndUpdate(
        { userId: oid(userId), carriedFrom: source._id, year, month, week },
        { $setOnInsert: {
          userId: oid(userId), year, month, week, title: source.title,
          description: source.description, category: source.category, priority: source.priority,
          completed: false, order: source.order, carriedFrom: source._id,
        } },
        { upsert: true, new: true, runValidators: true },
      );
    } catch (error: any) {
      if (error?.code === 11000) {
        logger.debug('Duplicate planner task ignored', { module: 'planner', collection: 'plannerTasks' });
        return PlannerTask.findOne({ userId: oid(userId), carriedFrom: source._id, year, month, week });
      }
      throw error;
    }
  },
};

