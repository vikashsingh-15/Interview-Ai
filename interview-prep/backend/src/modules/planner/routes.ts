import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';
import { plannerService } from './planner.service';

const router = Router();
router.use(authenticate);

router.get('/tasks', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tasks = await plannerService.list(req.user!.id, Number(req.query.year), Number(req.query.month));
  res.json({ success: true, data: tasks });
}));

router.post('/tasks', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const task = await plannerService.create(req.user!.id, req.body || {});
  res.status(201).json({ success: true, data: task });
}));

router.put('/tasks/:taskId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.taskId)) throw new ValidationError('Invalid planner task id');
  const task = await plannerService.update(req.user!.id, req.params.taskId, req.body || {});
  res.json({ success: true, data: task });
}));

router.delete('/tasks/:taskId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.taskId)) throw new ValidationError('Invalid planner task id');
  const task = await plannerService.remove(req.user!.id, req.params.taskId);
  res.json({ success: true, data: task });
}));

router.post('/tasks/:taskId/carry-forward', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.taskId)) throw new ValidationError('Invalid planner task id');
  const task = await plannerService.carryForward(
    req.user!.id, req.params.taskId, Number(req.body?.year), Number(req.body?.month), Number(req.body?.week),
  );
  res.json({ success: true, data: task });
}));

export default router;
