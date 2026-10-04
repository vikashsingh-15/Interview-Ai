import mongoose from 'mongoose';
import { NotFoundError, ValidationError } from '../../common/filters/error-filter';
import DailyRecord from '../calendar/daily-record.model';
import DailyTrackerEntry from './daily-tracker-entry.model';
import TrackerTask from './tracker-task.model';

const DEFAULT_TASKS = [
  { systemKey: 'interview-practice', name: 'Interview practice', category: 'Interview prep', targetValue: 5, unit: 'questions', frequency: 'daily', order: 0 },
  { systemKey: 'coding-problems', name: 'Coding problems', category: 'Coding', targetValue: 1, unit: 'problems', frequency: 'daily', order: 1 },
  { systemKey: 'system-design', name: 'System design practice', category: 'Interview prep', targetValue: 1, unit: 'session', frequency: 'daily', order: 2 },
  { systemKey: 'job-applications', name: 'Job applications', category: 'Career', targetValue: 2, unit: 'count', frequency: 'daily', order: 3 },
  { systemKey: 'study-time', name: 'Study time', category: 'Learning', targetValue: 60, unit: 'minutes', frequency: 'daily', order: 4 },
  { systemKey: 'mock-interviews', name: 'Mock interviews', category: 'Interview prep', targetValue: 1, unit: 'session', frequency: 'weekly', order: 5 },
] as const;

const QUESTION_TYPES = new Set(['technical', 'system_design', 'coding', 'project', 'revision', 'mock_interview', 'behavioral']);
const objectId = (id: string) => new mongoose.Types.ObjectId(id);

function dateKeyToDate(dateKey: string): Date {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? new Date(`${dateKey}T00:00:00.000Z`) : new Date(NaN);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    throw new ValidationError('Date must be a valid YYYY-MM-DD date');
  }
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function keyForDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function ensureDefaultTasks(userId: string) {
  const userObjectId = objectId(userId);
  const existing = await TrackerTask.find({ userId: userObjectId, systemKey: { $in: DEFAULT_TASKS.map((task) => task.systemKey) } }).select('systemKey').lean();
  const existingKeys = new Set(existing.map((task: any) => task.systemKey));
  const missing = DEFAULT_TASKS.filter((task) => !existingKeys.has(task.systemKey));
  await Promise.all(missing.map(async (task) => {
    try {
      await TrackerTask.updateOne(
        { userId: userObjectId, systemKey: task.systemKey },
        { $setOnInsert: { ...task, active: true, targetValue: task.targetValue } },
        { upsert: true },
      );
    } catch (error: any) {
      // A simultaneous first request can win the unique user/systemKey index.
      if (error?.code !== 11000) throw error;
    }
  }));
}

export const trackerService = {
  async listTasks(userId: string) {
    await ensureDefaultTasks(userId);
    return TrackerTask.find({ userId: objectId(userId), active: true }).sort({ order: 1, createdAt: 1 }).lean();
  },

  async createTask(userId: string, input: Record<string, any>) {
    const name = String(input.name || '').trim();
    if (!name || name.length > 100) throw new ValidationError('Task name is required and must be at most 100 characters');
    const targetValue = Number(input.targetValue ?? 1);
    if (!Number.isFinite(targetValue) || targetValue <= 0 || targetValue > 1000000) throw new ValidationError('Target must be greater than 0 and at most 1,000,000');
    return TrackerTask.create({
      userId: objectId(userId), name, targetValue,
      unit: input.unit || 'count', frequency: input.frequency || 'daily',
      description: input.description, category: input.category,
      order: Number.isInteger(input.order) ? input.order : 100,
    });
  },

  async updateTask(userId: string, taskId: string, input: Record<string, any>) {
    const allowed: Record<string, unknown> = {};
    for (const field of ['name', 'description', 'category', 'unit', 'frequency', 'order', 'active']) {
      if (input[field] !== undefined) allowed[field] = input[field];
    }
    if (input.targetValue !== undefined) {
      const target = Number(input.targetValue);
      if (!Number.isFinite(target) || target <= 0 || target > 1000000) throw new ValidationError('Target must be greater than 0 and at most 1,000,000');
      allowed.targetValue = target;
    }
    const task = await TrackerTask.findOneAndUpdate({ _id: taskId, userId: objectId(userId) }, { $set: allowed }, { new: true, runValidators: true });
    if (!task) throw new NotFoundError('Tracker task not found');
    return task;
  },

  async deactivateTask(userId: string, taskId: string) {
    const task = await TrackerTask.findOneAndUpdate({ _id: taskId, userId: objectId(userId) }, { $set: { active: false } }, { new: true });
    if (!task) throw new NotFoundError('Tracker task not found');
    return task;
  },

  async listEntries(userId: string, startKey: string, endKey = startKey) {
    const startDate = dateKeyToDate(startKey), endDate = dateKeyToDate(endKey);
    if (startKey > endKey) throw new ValidationError('end must be on or after start');
    if (endDate.getTime() - startDate.getTime() > 366 * 86400000) throw new ValidationError('Date range cannot exceed 366 days');
    const entries = await DailyTrackerEntry.find({ userId: objectId(userId), dateKey: { $gte: startKey, $lte: endKey } })
      .populate({ path: 'taskId', match: { userId: objectId(userId) }, select: 'name category targetValue unit frequency active order systemKey' })
      .sort({ dateKey: 1, createdAt: 1 }).lean();
    const records = await DailyRecord.find({ userId: objectId(userId), dateKey: { $gte: startKey, $lte: endKey } })
      .select('dateKey entries.type entries.count').lean();
    const suggestions = new Map<string, number>();
    for (const record of records as any[]) {
      const amount = (record.entries || []).reduce((sum: number, entry: any) =>
        sum + (QUESTION_TYPES.has(entry.type) ? (Number(entry.count) || 1) : 0), 0);
      suggestions.set(record.dateKey, amount);
    }
    return entries.filter((entry: any) => entry.taskId).map((entry: any) => ({
      ...entry,
      suggestion: entry.taskId.systemKey === 'interview-practice' ? suggestions.get(entry.dateKey) || 0 : undefined,
    }));
  },

  async saveEntry(userId: string, input: Record<string, any>) {
    const task = await TrackerTask.findOne({ _id: input.taskId, userId: objectId(userId), active: true });
    if (!task) throw new NotFoundError('Tracker task not found');
    const dateKey = String(input.dateKey || '');
    dateKeyToDate(dateKey);
    const actual = Number(input.actual);
    if (!Number.isFinite(actual) || actual < 0 || actual > 1000000) throw new ValidationError('Actual progress must be between 0 and 1,000,000');
    const existing = await DailyTrackerEntry.findOne({ userId: objectId(userId), taskId: task._id, dateKey });
    const completed = typeof input.completed === 'boolean' ? input.completed : actual >= task.targetValue;
    const update: Record<string, any> = {
      target: task.targetValue, actual, completed,
    };
    if (completed) update.completedAt = existing?.completedAt || new Date();
    if (input.notes !== undefined) update.notes = String(input.notes).slice(0, 1000);
    const mongoUpdate: Record<string, any> = { $set: update, $setOnInsert: { userId: objectId(userId), taskId: task._id, dateKey } };
    if (!completed) mongoUpdate.$unset = { completedAt: 1 };
    return DailyTrackerEntry.findOneAndUpdate(
      { userId: objectId(userId), taskId: task._id, dateKey },
      mongoUpdate,
      { upsert: true, new: true, runValidators: true },
    ).populate('taskId', 'name category targetValue unit frequency active order');
  },

  async deleteEntry(userId: string, entryId: string) {
    const result = await DailyTrackerEntry.findOneAndDelete({ _id: entryId, userId: objectId(userId) });
    if (!result) throw new NotFoundError('Tracker entry not found');
    return result;
  },

  async analytics(userId: string, period: 'today' | 'week' | 'month', anchor = new Date()) {
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const anchorDay = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
    const start = new Date(anchorDay), end = new Date(anchorDay);
    if (period === 'week') { start.setUTCDate(start.getUTCDate() - start.getUTCDay()); end.setUTCDate(start.getUTCDate() + 6); }
    else if (period === 'month') { start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0); }
    const reportEnd = end.getTime() > today.getTime() ? today : end;
    const startKey = keyForDate(start), endKey = keyForDate(reportEnd);
    const tasks = await TrackerTask.find({ userId: objectId(userId), active: true }).lean();
    const minReadDate = period === 'today' ? new Date(Date.UTC(anchorDay.getUTCFullYear(), anchorDay.getUTCMonth(), 1)) : start;
    const entries = await DailyTrackerEntry.find({ userId: objectId(userId), dateKey: { $gte: keyForDate(minReadDate), $lte: endKey } }).lean();
    const byTask = new Map<string, any[]>();
    for (const entry of entries) byTask.set(String(entry.taskId), [...(byTask.get(String(entry.taskId)) || []), entry]);
    const elapsedDays = reportEnd < start ? 0 : Math.floor((reportEnd.getTime() - start.getTime()) / 86400000) + 1;
    const firstWeekStart = new Date(start);
    firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - firstWeekStart.getUTCDay());
    const elapsedWeeks = reportEnd < start ? 0 : Math.floor((reportEnd.getTime() - firstWeekStart.getTime()) / (7 * 86400000)) + 1;
    const summary = tasks.filter((task: any) => period !== 'week' || task.frequency !== 'monthly').map((task: any) => {
      const allRows = byTask.get(String(task._id)) || [];
      const taskStart = period !== 'today' ? startKey : task.frequency === 'daily' ? keyForDate(anchorDay)
        : task.frequency === 'weekly' ? keyForDate(new Date(Date.UTC(anchorDay.getUTCFullYear(), anchorDay.getUTCMonth(), anchorDay.getUTCDate() - anchorDay.getUTCDay())))
          : keyForDate(new Date(Date.UTC(anchorDay.getUTCFullYear(), anchorDay.getUTCMonth(), 1)));
      const rows = allRows.filter((row) => row.dateKey >= taskStart && row.dateKey <= endKey);
      const target = period === 'today' ? task.targetValue
        : task.frequency === 'daily' ? task.targetValue * elapsedDays
          : task.frequency === 'weekly' ? task.targetValue * Math.max(1, period === 'month' ? elapsedWeeks : 1)
            : task.targetValue;
      const actual = rows.reduce((sum, row) => sum + row.actual, 0);
      return { taskId: String(task._id), name: task.name, unit: task.unit, frequency: task.frequency, target, actual, completed: actual >= target || (period === 'today' && rows.some(row => row.completed)) };
    });
    const complete = summary.filter(row => row.completed).length;
    const target = summary.reduce((sum, row) => sum + row.target, 0);
    const actual = summary.reduce((sum, row) => sum + row.actual, 0);
    const dailyTasks = tasks.filter((task: any) => task.frequency === 'daily');
    const streakStart = new Date(today); streakStart.setUTCDate(streakStart.getUTCDate() - 366);
    const dailyEntries = await DailyTrackerEntry.find({
      userId: objectId(userId), taskId: { $in: dailyTasks.map((task: any) => task._id) },
      dateKey: { $gte: keyForDate(streakStart), $lte: keyForDate(today) },
    }).select('taskId dateKey completed').lean();
    const completedByDay = new Map<string, Set<string>>();
    for (const entry of dailyEntries as any[]) {
      if (entry.completed) completedByDay.set(entry.dateKey, (completedByDay.get(entry.dateKey) || new Set()).add(String(entry.taskId)));
    }
    let streak = 0;
    let streakDate = today;
    const todayDone = dailyTasks.length > 0 && dailyTasks.every((task: any) => completedByDay.get(keyForDate(today))?.has(String(task._id)));
    if (!todayDone) { streakDate = new Date(today); streakDate.setUTCDate(streakDate.getUTCDate() - 1); }
    for (let offset = 0; dailyTasks.length && offset < 366; offset++) {
      const date = new Date(streakDate); date.setUTCDate(date.getUTCDate() - offset);
      const key = keyForDate(date);
      if (dailyTasks.every((task: any) => completedByDay.get(key)?.has(String(task._id)))) streak++;
      else break;
    }
    const dailyTotals = new Map<string, { actual: number; target: number }>();
    for (const entry of entries as any[]) {
      const value = dailyTotals.get(entry.dateKey) || { actual: 0, target: 0 };
      value.actual += entry.actual; value.target += entry.target; dailyTotals.set(entry.dateKey, value);
    }
    const totalsByUnit = new Map<string, { actual: number; target: number }>();
    for (const row of summary) {
      const value = totalsByUnit.get(row.unit) || { actual: 0, target: 0 };
      value.actual += row.actual; value.target += row.target; totalsByUnit.set(row.unit, value);
    }
    return {
      period, start: startKey, end: endKey, completed: complete, total: summary.length,
      completionPercent: summary.length ? Math.round(complete / summary.length * 100) : 0,
      target, actual, totalsByUnit: Object.fromEntries(totalsByUnit), currentStreak: streak, tasks: summary,
      days: [...dailyTotals.entries()].map(([dateKey, value]) => ({ dateKey, ...value })).sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    };
  },
};

export { dateKeyToDate };
