import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';
import { loadPracticeSource, listExperience } from './practice-source';
import { Question } from '../questions/question.model';
import {
  listTopics,
  startPracticeSet,
  getTopicQuestionAnswer,
  skipTopicQuestion,
  recordTopicFeedback,
  topicHistory,
  topicProgressSummary,
  listPracticeSkills,
  PRACTICE_DIFFICULTIES,
  PRACTICE_QUESTION_TYPES,
  normalizePracticeFilters,
} from './topic-practice.service';

const router = Router();
const sourceSchema = z.object({ kind: z.enum(['project', 'experience']), id: z.string().regex(/^[a-fA-F0-9]{24}$/) });
router.get('/experience', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.json({ success: true, data: await listExperience(req.user!.id) });
}));
router.get('/source/:kind/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const ref = sourceSchema.parse(req.params);
  const source = await loadPracticeSource(req.user!.id, ref);
  const questions = await Question.find({ ownerUserId: req.user!.id,
    'practiceSource.kind': source.kind, 'practiceSource.id': source.id,
    isHidden: false, isDeprecated: false, qualityStatus: 'approved' })
    .sort({ createdAt: -1 }).limit(100)
    .select('question topic subtopic difficulty questionType concepts estimatedAnswerTimeSeconds').lean();
  res.json({ success: true, data: { label: source.label, kind: source.kind, id: source.id, questions } });
}));

const FEEDBACK_KINDS = ['too_easy', 'too_hard', 'already_know', 'not_relevant', 'duplicate', 'incorrect', 'need_revision'] as const;

/**
 * GET /api/topics
 * Distinct topics in the visible question bank with difficulty counts.
 * Coding is always surfaced as its own topic.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const topics = await listTopics(req.user.id);
    res.json({ success: true, data: topics });
  })
);

/**
 * GET /api/topics/skills
 * Skill/topic names for the Practice Topic Wise picker: the user's resume and
 * profile skills first, then every topic already in their question bank.
 */
router.get(
  '/skills',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const skills = await listPracticeSkills(req.user.id);
    res.json({ success: true, data: skills });
  })
);

/**
 * GET /api/topics/progress
 * Per-topic practice progress for the signed-in user.
 */
router.get(
  '/progress',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const progress = await topicProgressSummary(req.user.id);
    res.json({ success: true, data: progress });
  })
);

/**
 * GET /api/topics/history?topic=Coding&limit=50
 * Practice history rows for one topic (or all topics).
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const topic = typeof req.query.topic === 'string' ? req.query.topic : undefined;
    const limit = Number(req.query.limit);
    const rows = await topicHistory({
      userId: req.user.id,
      topic,
      limit: Number.isFinite(limit) ? limit : undefined,
      source: req.query.sourceKind || req.query.sourceId
        ? sourceSchema.parse({ kind: req.query.sourceKind, id: req.query.sourceId }) : undefined,
    });
    res.json({ success: true, data: rows });
  })
);

/**
 * POST /api/topics/practice
 * Body: { topic, type?: 'all'|'easy'|'medium'|'hard'|'expert'|'practical', count? }
 * Returns a fresh practice set for the topic and logs each question as
 * presented in the calendar + question history.
 */
router.post(
  '/practice',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const body = z
      .object({
        topic: z.string().min(1).max(120),
        source: sourceSchema.optional(),
        /** Legacy single-select filter; mapped onto difficulties. */
        type: z.enum(['all', 'easy', 'medium', 'hard', 'expert', 'practical']).optional(),
        /** Multi-select difficulty filter; overrides the legacy field.
         *  (see routes/tests) */
        difficulties: z.array(z.enum(PRACTICE_DIFFICULTIES as [string, ...string[]])).max(4).optional(),
        questionTypes: z.array(z.enum(PRACTICE_QUESTION_TYPES as [string, ...string[]])).max(8).optional(),
        count: z.number().int().min(1).max(25).optional(),
        excludeQuestionIds: z.array(z.string()).max(50).optional(),
      })
      .parse(req.body || {});

    const result = await startPracticeSet({
      userId: req.user.id,
      topic: body.topic,
      source: body.source,
      type: body.type,
      difficulties: body.difficulties as any,
      questionTypes: body.questionTypes as any,
      count: body.count,
      excludeQuestionIds: body.excludeQuestionIds,
    });
    // Echo the normalized selection (the legacy `type` maps onto difficulties).
    const normalized = normalizePracticeFilters({
      type: body.type as any,
      difficulties: body.difficulties as any,
      questionTypes: body.questionTypes as any,
    });
    res.json({
      success: true,
      data: {
        topic: body.topic,
        difficulties: normalized.difficulties,
        questionTypes: normalized.questionTypes,
        questions: result.questions,
        generated: result.generated,
        message: result.message,
      },
    });
  })
);

/**
 * GET /api/topics/questions/:questionId/answer?regenerate=1
 * Cached or generated interview answer for a practice question.
 */
router.get(
  '/questions/:questionId/answer',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const regenerate = req.query.regenerate === '1' || req.query.regenerate === 'true';
    const answer = await getTopicQuestionAnswer({
      userId: req.user.id,
      topic: String(req.query.topic || ''),
      questionId: req.params.questionId,
      regenerate,
    });
    res.json({ success: true, data: answer });
  })
);

/**
 * POST /api/topics/questions/:questionId/generate-answer
 * Force a fresh answer generation even if one is cached.
 */
router.post(
  '/questions/:questionId/generate-answer',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const answer = await getTopicQuestionAnswer({
      userId: req.user.id,
      topic: String(req.body?.topic || ''),
      questionId: req.params.questionId,
      regenerate: true,
    });
    res.json({ success: true, data: answer });
  })
);

/**
 * POST /api/topics/questions/:questionId/skip
 */
router.post(
  '/questions/:questionId/skip',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const result = await skipTopicQuestion({ userId: req.user.id, questionId: req.params.questionId });
    res.json({ success: true, data: result, message: 'Question skipped' });
  })
);

/**
 * POST /api/topics/questions/:questionId/feedback
 * Body: { kind, notes? }
 */
router.post(
  '/questions/:questionId/feedback',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');
    const body = z
      .object({
        kind: z.enum(FEEDBACK_KINDS),
        notes: z.string().max(2000).optional(),
      })
      .parse(req.body || {});
    const result = await recordTopicFeedback({
      userId: req.user.id,
      questionId: req.params.questionId,
      kind: body.kind,
      notes: body.notes,
    });
    res.json({ success: true, data: result, message: 'Feedback saved' });
  })
);

export default router;
