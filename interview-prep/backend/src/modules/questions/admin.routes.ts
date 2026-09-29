import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizeAdmin } from '../../common/middleware/auth';
import { asyncHandler, NotFoundError } from '../../common/filters/error-filter';
import { Question } from './question.model';
import { AIRequest } from '../../common/services/structured-ai';
const router = Router();
router.use(authenticate,authorizeAdmin);
router.get('/questions',asyncHandler(async(req,res)=>{
  const filter = typeof req.query.status === 'string' ? { qualityStatus:req.query.status } : {};
  res.json({success:true,data:await Question.find(filter).sort({updatedAt:-1}).limit(100).select('-embedding').lean()});
}));
router.patch('/questions/:id',asyncHandler(async(req,res)=>{
  const data = z.object({ qualityStatus:z.enum(['pending','approved','flagged','rejected']).optional(),
    isDeprecated:z.boolean().optional() }).parse(req.body);
  const question = await Question.findByIdAndUpdate(req.params.id,data,{new:true,runValidators:true});
  if (!question) throw new NotFoundError('Question not found');
  res.json({success:true,data:question});
}));
router.get('/ai-usage',asyncHandler(async(req,res)=>{
  res.json({success:true,data:await AIRequest.find().sort({createdAt:-1}).limit(100).lean()});
}));
export default router;
