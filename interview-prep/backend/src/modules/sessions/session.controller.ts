import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, NotFoundError } from '../../common/filters/error-filter';
import { sessionService } from './session.service';
import { DailySession } from './daily-session.model';
import mongoose from 'mongoose';
import { z } from 'zod';

const router = Router();

// Generate today's session
router.post(
  '/generate',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const date = new Date(req.body.date || Date.now());

    const session = await sessionService.generateDailySession(req.user.id, date, {
      retryEmpty: req.body?.retryEmpty === true,
    });

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        sessionDate: session.sessionDate,
        userDayNumber: session.userDayNumber,
        generationState: session.generationState,
        generationMessage: session.generationMessage,
        status: session.status,
        totalQuestions: session.totalQuestions,
        sections: session.sections?.map((section: any) => ({
          id: section._id,
          type: section.type,
          title: section.title,
          description: section.description,
          totalQuestions: section.totalQuestions,
          completedQuestions: section.completedQuestions,
          topic: section.topic,
        })),
      },
      message: 'Session generated successfully',
    });
  })
);

// Get today's session
router.get(
  '/today',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    let session = await sessionService.getTodaysSession(req.user.id);

    // If no session exists, generate one
    if (!session) {
      await sessionService.generateDailySession(req.user.id);
      session = await sessionService.getTodaysSession(req.user.id);
    }

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        sessionDate: session.sessionDate,
        userDayNumber: session.userDayNumber,
        status: session.status,
        generationState: session.generationState,
        generationMessage: session.generationMessage,
        totalQuestions: session.totalQuestions,
        completedQuestions: session.completedQuestions,
        averageScore: session.averageScore,
        revisionsDue: session.revisionsDue,
        revisionsCompleted: session.revisionsCompleted,
        sections: session.sections?.map((section: any) => ({
          id: section._id,
          type: section.type,
          title: section.title,
          description: section.description,
          status: section.status,
          totalQuestions: section.totalQuestions,
          completedQuestions: section.completedQuestions,
          topic: section.topic,
          subtopic: section.subtopic,
          questions: section.questions?.map((q: any) => ({
            id: q._id,
            question: q.questionSnapshot?.question,
            topic: q.questionSnapshot?.topic,
            subtopic: q.questionSnapshot?.subtopic,
            concepts: q.questionSnapshot?.concepts,
            difficulty: q.questionSnapshot?.difficulty,
            questionType: q.questionSnapshot?.questionType,
            archetype: q.questionSnapshot?.archetype,
            interviewPriority: q.questionSnapshot?.interviewPriority,
            estimatedTimeSeconds: q.questionSnapshot?.estimatedAnswerTimeSeconds,
            isSystemDesign: q.questionSnapshot?.isSystemDesign,
            isCoding: q.questionSnapshot?.isCoding,
            isProjectInterview: q.questionSnapshot?.isProjectInterview,
            status: q.status,
            answer: q.answer,
            answerTimeSeconds: q.answerTimeSeconds,
            finalScore: q.finalScore,
            userNotes: q.userNotes,
            bookmarked: q.bookmarked,
            flagged: q.flagged,
          })),
        })),
        topicSelectionRationale: session.topicSelectionRationale,
      },
    });
  })
);

// Get session by ID
router.get(
  '/:sessionId([a-fA-F0-9]{24})',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { sessionId } = req.params;

    const session = await sessionService.getSessionById(sessionId, req.user.id);

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        sessionDate: session.sessionDate,
        userDayNumber: session.userDayNumber,
        status: session.status,
        generationState: session.generationState,
        generationMessage: session.generationMessage,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        totalTimeSeconds: session.totalTimeSeconds,
        totalQuestions: session.totalQuestions,
        completedQuestions: session.completedQuestions,
        correctQuestions: session.correctQuestions,
        averageScore: session.averageScore,
        sections: session.sections?.map((section: any) => ({
          id: section._id,
          type: section.type,
          title: section.title,
          description: section.description,
          status: section.status,
          totalQuestions: section.totalQuestions,
          completedQuestions: section.completedQuestions,
          topic: section.topic,
          subtopic: section.subtopic,
          questions: section.questions?.map((q: any) => ({
            id: q._id,
            order: q.order,
            status: q.status,
            question: q.questionSnapshot?.question,
            topic: q.questionSnapshot?.topic,
            subtopic: q.questionSnapshot?.subtopic,
            concepts: q.questionSnapshot?.concepts,
            difficulty: q.questionSnapshot?.difficulty,
            questionType: q.questionSnapshot?.questionType,
            archetype: q.questionSnapshot?.archetype,
            interviewPriority: q.questionSnapshot?.interviewPriority,
            estimatedTimeSeconds: q.questionSnapshot?.estimatedAnswerTimeSeconds,
            isSystemDesign: q.questionSnapshot?.isSystemDesign,
            isCoding: q.questionSnapshot?.isCoding,
            isProjectInterview: q.questionSnapshot?.isProjectInterview,
            isRevision: q.isRevision,
            revisionNumber: q.revisionNumber,
            answer: q.answer,
            answerTimeSeconds: q.answerTimeSeconds,
            answerSubmittedAt: q.answerSubmittedAt,
            evaluation: q.evaluation,
            finalScore: q.finalScore,
            selfAssessedScore: q.selfAssessedScore,
            userNotes: q.userNotes,
            bookmarked: q.bookmarked,
            flagged: q.flagged,
          })),
        })),
        topicSelectionRationale: session.topicSelectionRationale,
      },
    });
  })
);

// Submit answer
router.get('/:sessionId/questions/:questionId/answer', authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const answer = await sessionService.getInterviewAnswer(req.params.sessionId, req.params.questionId, req.user!.id);
    res.json({ success:true, data:{ answer } });
  }));

router.post('/:sessionId/questions/:questionId/review', authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const completedQuestions = await sessionService.markQuestionReviewed(req.params.sessionId, req.params.questionId, req.user!.id);
    res.json({ success:true, data:{ completedQuestions } });
  }));

// Skip a question: resolved without answering; excluded from scores.
router.post('/:sessionId/questions/:questionId/skip', authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await sessionService.skipQuestion(req.params.sessionId, req.params.questionId, req.user!.id);
    res.json({ success:true, data:result, message:'Question skipped' });
  }));

// Replace today's pending questions with a fresh set from current preferences.
router.post('/today/regenerate', authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const session = await sessionService.regenerateTodaySession(req.user!.id, new Date(req.body?.date || Date.now()));
    res.json({
      success:true,
      data:{
        sessionId: session._id, status: session.status,
        generationState: session.generationState, generationMessage: session.generationMessage,
        totalQuestions: session.totalQuestions, completedQuestions: session.completedQuestions,
      },
      message:'Fresh questions generated',
    });
  }));

// Submit answer
router.post(
  '/:sessionId/answers/:questionId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { sessionId, questionId } = req.params;
    const { answer } = req.body;

    // Validate answer
    if (!answer || answer.trim().length < 10) {
      throw new Error('Answer must be at least 10 characters');
    }

    const result = await sessionService.submitAnswer(
      sessionId,
      questionId,
      answer,
      req.user.id
    );

    res.json({
      success: true,
      data: result,
      message: 'Answer submitted successfully',
    });
  })
);

// Start session
router.post(
  '/:sessionId/start',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { sessionId } = req.params;

    const session = await DailySession.findById(new mongoose.Types.ObjectId(sessionId));

    if (!session || session.userId.toString() !== req.user.id) {
      throw new Error('Session not found');
    }

    if (session.status !== 'pending') {
      throw new Error('Session has already been started');
    }

    session.status = 'in_progress';
    session.startedAt = new Date();
    await session.save();

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        status: session.status,
        startedAt: session.startedAt,
      },
      message: 'Session started',
    });
  })
);

// Complete session
router.post(
  '/:sessionId/complete',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { sessionId } = req.params;

    const session = await sessionService.completeSession(sessionId, req.user.id);

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        status: session.status,
        completedAt: session.completedAt,
        totalTimeSeconds: session.totalTimeSeconds,
        totalQuestions: session.totalQuestions,
        completedQuestions: session.completedQuestions,
        averageScore: session.averageScore,
      },
      message: 'Session completed',
    });
  })
);

// Get session history
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { page, limit, startDate, endDate } = req.query;

    const result = await sessionService.getSessionHistory(req.user.id, {
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get specific day (by day number)
router.get(
  '/day/:dayNumber',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { dayNumber } = req.params;

    // Calculate date from day number
    const firstSessionDate = await DailySession.findOne(
      { userId: new mongoose.Types.ObjectId(req.user.id), isDeleted: false }
    )
      .sort({ sessionDate: 1 })
      .select('sessionDate');

    if (!firstSessionDate) {
      throw new Error('No sessions found');
    }

    const targetDate = new Date(firstSessionDate.sessionDate);
    targetDate.setDate(targetDate.getDate() + parseInt(dayNumber, 10) - 1);

    const session = await sessionService.getSessionById(
      (await sessionService.getTodaysSession(req.user.id))?.sessionDate?.toString() || '',
      req.user.id
    );

    // Find session by date
    const sessionByDate = await DailySession.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      sessionDate: {
        $gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
        $lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
      },
      isDeleted: false,
    })
      .populate({
        path: 'sections',
        populate: {
          path: 'questions',
          model: 'SessionQuestion',
        },
      })
      .lean();

    if (!sessionByDate) {
      throw new Error(`Day ${dayNumber} session not found`);
    }

    res.json({
      success: true,
      data: {
        sessionId: sessionByDate._id,
        sessionDate: sessionByDate.sessionDate,
        userDayNumber: sessionByDate.userDayNumber,
        status: sessionByDate.status,
        startedAt: sessionByDate.startedAt,
        completedAt: sessionByDate.completedAt,
        totalTimeSeconds: sessionByDate.totalTimeSeconds,
        totalQuestions: sessionByDate.totalQuestions,
        completedQuestions: sessionByDate.completedQuestions,
        averageScore: sessionByDate.averageScore,
        sections: sessionByDate.sections?.map((section: any) => ({
          id: section._id,
          type: section.type,
          title: section.title,
          description: section.description,
          status: section.status,
          totalQuestions: section.totalQuestions,
          completedQuestions: section.completedQuestions,
          topic: section.topic,
          subtopic: section.subtopic,
          questions: section.questions?.map((q: any) => ({
            id: q._id,
            order: q.order,
            status: q.status,
            question: q.questionSnapshot?.question,
            topic: q.questionSnapshot?.topic,
            subtopic: q.questionSnapshot?.subtopic,
            difficulty: q.questionSnapshot?.difficulty,
            questionType: q.questionSnapshot?.questionType,
            archetype: q.questionSnapshot?.archetype,
            estimatedTimeSeconds: q.questionSnapshot?.estimatedAnswerTimeSeconds,
            isSystemDesign: q.questionSnapshot?.isSystemDesign,
            isCoding: q.questionSnapshot?.isCoding,
            isProjectInterview: q.questionSnapshot?.isProjectInterview,
            isRevision: q.isRevision,
            revisionNumber: q.revisionNumber,
            answer: q.answer,
            finalScore: q.finalScore,
            userNotes: q.userNotes,
            bookmarked: q.bookmarked,
            flagged: q.flagged,
          })),
        })),
      },
    });
  })
);

export default router;
