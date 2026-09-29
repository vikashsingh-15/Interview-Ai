import { Router } from 'express';
import { z } from 'zod';
import mongoose, { Schema } from 'mongoose';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, NotFoundError } from '../../common/filters/error-filter';
import { DailySession, SessionQuestion } from '../sessions/daily-session.model';
import { QuestionHistory } from './question-history.model';
import { Question } from './question.model';
import { Revision } from '../revisions/revision.model';
export const QuestionFeedback = mongoose.model('QuestionFeedback', new Schema({
  userId: Schema.Types.ObjectId, sessionId: Schema.Types.ObjectId, questionId: Schema.Types.ObjectId,
  kind: String, notes: String,
}, { timestamps:true }));
const router = Router();
router.post('/:sessionId/:mappingId', authenticate, asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const data = z.object({ kind:z.enum(['completed','failed','skipped','too_easy','too_hard','already_know',
    'not_relevant','duplicate','incorrect','need_revision']), notes:z.string().max(2000).default('') }).parse(req.body);
  if (!await DailySession.exists({ _id:req.params.sessionId,userId:req.user!.id })) throw new NotFoundError('Session not found');
  const mapped = await SessionQuestion.findOne({ _id:req.params.mappingId,sessionId:req.params.sessionId });
  if (!mapped) throw new NotFoundError('Question not found');
  const question = await Question.findById(mapped.questionId);
  if (!question) throw new NotFoundError('Question not found');
  await QuestionFeedback.create({ userId:req.user!.id,sessionId:mapped.sessionId,questionId:question._id,...data });
  const history = await QuestionHistory.findOneAndUpdate({ userId:req.user!.id,questionId:question._id },{
    $setOnInsert:{ questionVersion:question.version,sessionId:mapped.sessionId,questionSnapshot:{
      ...mapped.questionSnapshot,resumeRelevance:question.resumeRelevance,expectedAnswerDepth:question.expectedAnswerDepth,
      provenance:question.provenance },status:'NEW' },
    $set:{ feedback:data.kind, ...(data.kind === 'already_know' ? { difficultyFeedback:'already_knew' } :
      ['too_easy','too_hard','not_relevant','duplicate','incorrect'].includes(data.kind) ? { difficultyFeedback:data.kind } : {}) },
  },{ upsert:true,new:true });
  if (data.kind === 'skipped') { mapped.status='skipped'; await mapped.save(); }
  if (['duplicate','incorrect'].includes(data.kind)) await Question.updateOne({ _id:question._id },{ qualityStatus:'flagged' });
  if (['failed','need_revision','too_hard'].includes(data.kind)) {
    try { await (Revision as any).createRevision(new mongoose.Types.ObjectId(req.user!.id),history,question); }
    catch(error:any) { if (error.code !== 11000) throw error; }
  }
  res.json({ success:true,message:'Feedback saved. Future planning will use it.' });
}));
export default router;
