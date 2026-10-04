import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';
import DailyRecord from '../calendar/daily-record.model';
import DailyTrackerEntry from './daily-tracker-entry.model';
import { trackerService } from './tracker.service';

const router = Router();
router.use(authenticate);

router.get('/tasks', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tasks = await trackerService.listTasks(req.user!.id);
  res.json({ success: true, data: tasks });
}));

router.post('/tasks', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const task = await trackerService.createTask(req.user!.id, req.body || {});
  res.status(201).json({ success: true, data: task });
}));

router.put('/tasks/:taskId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.taskId)) throw new ValidationError('Invalid tracker task id');
  const task = await trackerService.updateTask(req.user!.id, req.params.taskId, req.body || {});
  res.json({ success: true, data: task });
}));

router.delete('/tasks/:taskId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.taskId)) throw new ValidationError('Invalid tracker task id');
  const task = await trackerService.deactivateTask(req.user!.id, req.params.taskId);
  res.json({ success: true, data: task });
}));

router.get('/entries', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const date = String(req.query.date || '');
  const start = String(req.query.start || date);
  const end = String(req.query.end || date);
  if (!start) throw new ValidationError('Provide date or start/end date');
  const entries = await trackerService.listEntries(req.user!.id, start, end);
  res.json({ success: true, data: entries });
}));

router.post('/entries', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!mongoose.isValidObjectId(req.body?.taskId)) throw new ValidationError('Invalid task id');
  const entry = await trackerService.saveEntry(req.user!.id, req.body || {});
  res.status(201).json({ success: true, data: entry });
}));

router.delete('/entries/:entryId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.entryId)) throw new ValidationError('Invalid tracker entry id');
  const entry = await trackerService.deleteEntry(req.user!.id, req.params.entryId);
  res.json({ success: true, data: entry });
}));

router.get('/today', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = new mongoose.Types.ObjectId(req.user!.id);
  const dateKey = new Date().toISOString().slice(0, 10);
  const tasks = await trackerService.listTasks(req.user!.id);
  const today = new Date();
  const weekStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - today.getUTCDay())).toISOString().slice(0, 10);
  const monthStart = `${dateKey.slice(0, 7)}-01`;
  const [storedEntries, suggestions, analytics] = await Promise.all([
    DailyTrackerEntry.find({ userId, dateKey: { $gte: monthStart, $lte: dateKey } }).lean(),
    DailyRecord.findOne({ userId, dateKey }).select('entries.type entries.count').lean(),
    trackerService.analytics(req.user!.id, 'today'),
  ]);
  const entries = tasks.map((task: any) => {
    const start = task.frequency === 'daily' ? dateKey : task.frequency === 'weekly' ? weekStart : monthStart;
    const rows = storedEntries.filter((entry: any) => String(entry.taskId) === String(task._id) && entry.dateKey >= start);
    const actual = rows.reduce((total: number, entry: any) => total + entry.actual, 0);
    return { taskId: String(task._id), actual, completed: actual >= task.targetValue || rows.some((entry: any) => entry.completed) };
  });
  const suggestedInterviewQuestions = (suggestions?.entries || []).reduce((total: number, entry: any) =>
    total + (['technical', 'system_design', 'coding', 'project', 'revision', 'mock_interview', 'behavioral'].includes(entry.type) ? Number(entry.count) || 1 : 0), 0);
  res.json({ success: true, data: { dateKey, tasks, entries, suggestedInterviewQuestions, analytics } });
}));

router.get('/analytics/target-vs-actual', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const period = String(req.query.period || 'month');
  if (!Number.isInteger(year) || year < 1970 || year > 2999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new ValidationError('Provide a valid year and month');
  }
  if (period !== 'month' && period !== 'week') throw new ValidationError('Period must be month or week');
  const anchor = new Date(Date.UTC(year, month - 1, 1));
  const analytics = await trackerService.analytics(req.user!.id, period, anchor);
  res.json({ success: true, data: analytics });
}));

router.get('/analytics/:period', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!['today', 'week', 'month'].includes(req.params.period)) throw new ValidationError('Period must be today, week, or month');
  const analytics = await trackerService.analytics(req.user!.id, req.params.period as 'today' | 'week' | 'month');
  res.json({ success: true, data: analytics });
}));

export default router;
