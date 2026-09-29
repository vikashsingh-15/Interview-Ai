import { randomUUID } from 'crypto';
import { generatePersonalizedQuestions, reserveQuestion } from '../questions/personalized-generator';
import mongoose from 'mongoose';
import config from '../../config';
import logger from '../../config/logger';
import { DailySession, SessionQuestion } from './daily-session.model';
import { Question } from '../questions/question.model';
import { QuestionHistory as QuestionHistoryModel } from '../questions/question-history.model';
import { Revision } from '../revisions/revision.model';
import ResumeProfile from '../resume/resume-profile.model';
import InterviewProfile from '../profile/interview-profile.model';
import SkillGraph from '../skill-graph/skill-graph.model';
import { NotFoundError, ConflictError, InternalError, RateLimitError } from '../../common/filters/error-filter';
import { QuestionType, Difficulty, Provenance } from '../questions/question.model';
import { calendarService, recordQuestionInDailyCalendar } from '../calendar/calendar.service';
import {
  evaluateAnswer,
  toRevisionEvaluation,
  getOpenAIClient,
  EvaluationResult,
} from '../evaluation/answer-evaluation';

// Session generation service
export const sessionService = {
  // Generate daily session for a user
  async generateDailySession(userId: string, date: Date = new Date(), options: { retryEmpty?: boolean } = {}): Promise<any> {
    if (Number.isNaN(date.getTime())) throw new ConflictError('Invalid session date');
    const sessionDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const owner = randomUUID();
    let existingSession = await DailySession.findOne({ userId, sessionDate });
    if (existingSession && (!existingSession.generationStartedAt || existingSession.generationState === 'completed')) {
      const canRetryEmpty = options.retryEmpty === true && existingSession.totalQuestions === 0 &&
        (existingSession.completedQuestions || 0) === 0 &&
        !(await SessionQuestion.exists({ sessionId: existingSession._id }));
      if (!canRetryEmpty) return existingSession;

      existingSession = await DailySession.findOneAndUpdate({
        _id: existingSession._id,
        totalQuestions: 0,
        $and: [
          { $or: [{ generationState: 'completed' }, { generationState: { $exists: false } }] },
          { $or: [{ completedQuestions: 0 }, { completedQuestions: { $exists: false } }] },
        ],
      }, {
        $set: { generationState: 'generating', generationOwner: owner, generationStartedAt: new Date(),
          generationMessage: 'Retrying question generation', status: 'pending' },
        $unset: { completedAt: 1 },
      }, { new: true });
      if (!existingSession) throw new ConflictError('Session changed before retry. Reload and try again.');
    }
    // Load user profile and data
    const interviewProfile = await InterviewProfile.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!interviewProfile?.onboardingCompleted) {
      throw new NotFoundError('Interview profile not found. Please complete onboarding first.');
    }

    const skillGraph = await SkillGraph.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    const dueRevisions = await Revision.find({
      userId: new mongoose.Types.ObjectId(userId),
      status: { $in: ['pending', 'due'] },
      dueDate: { $lte: date },
    }).sort({ dueDate: 1 });

    // Calculate user day number
    const dayNumber = await this.calculateUserDayNumber(userId);

    // Unique user/date plus a persisted lease coordinates tabs, devices and API replicas.
    if (!existingSession) {
      try {
        existingSession = await DailySession.create({
          userId, sessionDate, userDayNumber: dayNumber, status:'pending',
          generationState:'generating', generationOwner:owner, generationStartedAt:new Date(),
          revisionsDue:dueRevisions.length,
          interviewProfileSnapshot: {
            experienceLevel:interviewProfile.targetLevel || interviewProfile.experienceLevel,
            targetRole:interviewProfile.targetRole, targetCompanies:interviewProfile.targetCompanies,
            primaryLanguages:interviewProfile.primaryLanguages, frameworks:interviewProfile.frameworks,
            databases:interviewProfile.databases, systemDesignLevel:interviewProfile.systemDesignLevel,
          },
        });
      } catch(error:any) {
        if (error.code !== 11000) throw error;
        existingSession = await DailySession.findOne({ userId, sessionDate });
      }
    }
    if (!existingSession) throw new InternalError('Could not reserve session');
    const session = existingSession.generationOwner === owner ? existingSession :
      await DailySession.findOneAndUpdate({
        _id:existingSession._id,
        $or:[{ generationState:'failed' },{ generationStartedAt:{ $lt:new Date(Date.now()-10*60000) } }],
      }, { generationState:'generating', generationOwner:owner, generationStartedAt:new Date() }, { new:true });
    if (!session) throw new ConflictError('Session generation is already in progress. Reload shortly.');
    try {
    // Generate sections based on user preferences
    const sections = await this.generateSections(
      session._id,
      userId,
      interviewProfile,
      skillGraph,
      dueRevisions,
      date
    );

    // Populate sections
    session.sections = sections;
    session.generationState = 'completed';
    session.totalQuestions = sections.reduce((sum, s) => sum + s.totalQuestions, 0);
    session.generationMessage = session.totalQuestions === 0
      ? 'No questions were generated. Check your AI provider settings or add available topics, then retry.'
      : sections.some(s=>s.notes) ? 'Some sections contain fewer questions; no repeats were inserted.' : undefined;
    await DailySession.updateOne({ _id:session._id, generationOwner:owner }, { $set:{
      sections, totalQuestions:session.totalQuestions, generationState:'completed',
      generationMessage:session.generationMessage,
    } });

    // Record every question asked today in the user's calendar record
    try {
      const { SessionQuestion: SQ } = await import('./daily-session.model');
      const sessionQuestions = await SQ.find({ sessionId: session._id })
        .sort({ order: 1 })
        .lean();

      for (const sq of sessionQuestions) {
        const snapshot = (sq as any).questionSnapshot || {};
        await recordQuestionInDailyCalendar(userId, {
          type: snapshot.isCoding
            ? 'coding'
            : snapshot.isSystemDesign
              ? 'system_design'
              : snapshot.isProjectInterview
                ? 'project'
                : sq.isRevision
                  ? 'revision'
                  : 'technical',
          title: snapshot.question || 'Question',
          topic: snapshot.topic,
          subtopic: snapshot.subtopic,
          concepts: snapshot.concepts,
          difficulty: snapshot.difficulty,
          status: 'presented',
          occurredAt: session.sessionDate || date,
        });
      }
    } catch (calendarErr) {
      logger.warn('Failed to record generated session in daily calendar', {
        error: (calendarErr as Error).message,
      });
    }

    logger.info('Daily session generated', {
      userId,
      dayNumber,
      date: session.sessionDate,
      totalQuestions: session.totalQuestions,
    });

    return session;
    } catch (error) {
      await DailySession.updateOne({ _id:session._id, generationOwner:owner }, {
        $set: { generationState:'failed', generationMessage:error instanceof RateLimitError
          ? error.message : 'Generation failed. Check your AI provider settings, then retry.' },
        $unset: { generationOwner: 1 },
      });
      throw error;
    }
  },

  // Calculate user day number
  async calculateUserDayNumber(userId: string): Promise<number> {
    const completedSessions = await DailySession.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'completed',
      isDeleted: false,
    });

    return completedSessions + 1;
  },

  // Generate sections for session
  async generateSections(
    sessionId: mongoose.Types.ObjectId,
    userId: string,
    interviewProfile: any,
    skillGraph: any,
    dueRevisions: any[],
    date: Date
  ): Promise<any[]> {
    const session = await DailySession.findById(sessionId);
    if (!session) throw new NotFoundError('Session not found');
    const plan = interviewProfile.dailyPlan?.length ? interviewProfile.dailyPlan : [{
      title:'Professional practice', topic:interviewProfile.confirmedSkills[0] || interviewProfile.targetRole || 'Professional experience',
      type:'technical', count:interviewProfile.preferences.dailyQuestions ?? 5,
    }];
    // Revision is an explicitly labeled repeat, never counted as fresh practice.
    if (dueRevisions.length && !session.sections.some(s=>s.type === 'revision')) {
      const revision = await this.generateRevisionSection(sessionId,userId,dueRevisions,0);
      session.sections.push(revision);
      await session.save();
    }
    for (const planned of plan) {
      if (!planned.count) continue;
      let section = session.sections.find(s=>s.title === planned.title && s.topic === planned.topic);
      if (!section) {
        session.sections.push({ _id:new mongoose.Types.ObjectId(), type:planned.type,
          title:planned.title, topic:planned.topic, order:session.sections.length, status:'pending',
          totalQuestions:0, completedQuestions:0, questions:[],
          description:'Personalized from confirmed facts and your preferences' });
        await session.save();
        section = session.sections[session.sections.length-1];
      }
      // Recover durable mappings created just before an interrupted section checkpoint.
      const assigned = await SessionQuestion.find({ sessionId, sectionId:section._id }).sort({ order:1 });
      section.questions = assigned.map(q=>q._id);
      section.totalQuestions = assigned.length;
      const needed = planned.count-assigned.length;
      if (needed <= 0) continue;
      section.notes = undefined;
      if (planned.type === 'coding') {
        const ownedSessions = await DailySession.find({ userId }).select('_id').lean();
        const prior = await SessionQuestion.find({ sessionId:{ $in:ownedSessions.map(s=>s._id) },
          'questionSnapshot.isCoding':true }).select('questionId').lean();
        const priorQuestions = await Question.find({ _id:{ $in:prior.map(p=>p.questionId) } }).select('sourceId').lean();
        const problems = await mongoose.model('CodingProblem').find({
          isHidden:false,isDeprecated:false,isInterviewRelevant:true,
          _id:{ $nin:priorQuestions.map(q=>q.sourceId).filter(Boolean) },
        }).limit(needed).lean();
        for (const p of problems) {
          // Canonicalize curated coding metadata; never execute arbitrary AI code.
          const canonical = await Question.findOneAndUpdate({ sourceId:String(p._id), provenance:'CURATED' },
            { $setOnInsert:{ question:p.title,topic:planned.topic,subtopic:(p.pattern || []).join(', ') || 'Algorithms',
              concepts:p.tags || [], difficulty:String(p.difficulty || 'medium').toUpperCase(),
              questionType:'CODING',archetype:'IMPLEMENTATION',provenance:'CURATED',qualityStatus:'approved',
              isCoding:true,sourceId:String(p._id),sourceUrl:p.url,
              codingProblem:{ description:p.description, constraints:p.constraints, examples:p.examples,
                starterCode:Object.values(p.starterCode || {})[0], pattern:(p.pattern || []).join(', ') } } },
            { upsert:true,new:true });
          await add(canonical);
        }
      } else {
        const questions = await generatePersonalizedQuestions(userId,planned.topic,needed,planned.type,sessionId);
        for (const question of questions) await add(question);
      }
      if (section.totalQuestions < planned.count) section.notes =
        'Not enough new validated questions available. Configure AI or expand your topics; repeats were not inserted.';
      await session.save();

      async function add(question:any) {
        if (!await reserveQuestion(userId,sessionId,question)) return;
        const mapped = await SessionQuestion.create({
          sessionId,sectionId:section!._id,questionId:question._id,order:section!.questions.length,status:'pending',
          questionSnapshot:{ question:question.isCoding ? question.question+'\n\n'+(question.codingProblem?.description || '') : question.question,topic:question.topic,subtopic:question.subtopic,
            concepts:question.concepts,difficulty:question.difficulty,questionType:question.questionType,
            archetype:question.archetype,interviewPriority:question.interviewPriority,
            estimatedAnswerTimeSeconds:question.estimatedAnswerTimeSeconds,isCoding:question.isCoding,
            isSystemDesign:question.isSystemDesign,isProjectInterview:question.isProjectInterview },
        });
        section!.questions.push(mapped._id);
        section!.totalQuestions = section!.questions.length;
        await session!.save();
      }
    }
    return session.sections as any[];
  },

  // Generate revision section
  async generateRevisionSection(
    sessionId: mongoose.Types.ObjectId,
    userId: string,
    revisions: any[],
    order: number
  ): Promise<any> {
    const sectionQuestions: any[] = [];
    const sectionId = new mongoose.Types.ObjectId();

    for (const revision of revisions.slice(0, 10)) {
      const questionHistory = await QuestionHistoryModel.findOne({ _id: revision.questionHistoryId, userId });
      if (!questionHistory) continue;

      const question = await Question.findById(revision.originalQuestionId);
      if (!question) continue;

      const sessionQuestion = await SessionQuestion.create({
        sessionId,
        questionId: question._id,
        sectionId,
        order: sectionQuestions.length,
        isRevision: true,
        revisionNumber: revision.revisionNumber,
        status: 'pending',
        questionSnapshot: {
          question: question.question,
          topic: question.topic,
          subtopic: question.subtopic,
          concepts: question.concepts,
          difficulty: question.difficulty,
          questionType: question.questionType,
          archetype: question.archetype,
          interviewPriority: question.interviewPriority,
          estimatedAnswerTimeSeconds: question.estimatedAnswerTimeSeconds,
          isSystemDesign: question.isSystemDesign,
          isCoding: question.isCoding,
          isProjectInterview: question.isProjectInterview,
        },
      });

      sectionQuestions.push(sessionQuestion);
    }

    return {
      _id: sectionId,
      type: 'revision',
      title: 'Revision',
      description: `${revisions.length} questions due for revision`,
      order,
      status: 'pending',
      totalQuestions: sectionQuestions.length,
      completedQuestions: 0,
      questions: sectionQuestions.map(q => q._id),
      topic: 'Revision',
    };
  },

  // Get today's session
  async getTodaysSession(userId: string): Promise<any> {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const session = await DailySession.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      sessionDate: today,
      isDeleted: false,
    })
      .populate({
        path: 'sections.questions',
        model: 'SessionQuestion',
      })
      .lean();

    return session || null;
  },

  // Get session by ID
  async getSessionById(sessionId: string, userId: string): Promise<any> {
    const session = await DailySession.findOne({
      _id: new mongoose.Types.ObjectId(sessionId),
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    })
      .populate({
        path: 'sections.questions',
        model: 'SessionQuestion',
      })
      .lean();

    return session || null;
  },

  // Submit answer
  async submitAnswer(
    sessionId: string,
    questionId: string,
    answer: string,
    userId: string
  ): Promise<any> {
    const session = await DailySession.findById(new mongoose.Types.ObjectId(sessionId));

    if (!session || session.userId.toString() !== userId) {
      throw new NotFoundError('Session not found');
    }

    const sessionQuestion = await SessionQuestion.findOne({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      $or: [{ questionId: new mongoose.Types.ObjectId(questionId) }, { _id: new mongoose.Types.ObjectId(questionId) }],
    });

    if (!sessionQuestion) {
      throw new NotFoundError('Question not found in session');
    }

    // Record answer
    sessionQuestion.answer = answer;
    sessionQuestion.answerTimeSeconds = Math.floor(
      (Date.now() - new Date(sessionQuestion.createdAt || Date.now()).getTime()) / 1000
    );
    sessionQuestion.answerSubmittedAt = new Date();
    sessionQuestion.status = 'answered';
    await sessionQuestion.save();

    // Load the full question (needed for reference answers, concepts, archetype)
    const question = await Question.findById(sessionQuestion.questionId);

    // ---------------- AI answer evaluation ----------------
    let evaluation: EvaluationResult | null = null;
    try {
      evaluation = await evaluateAnswer({
        userId,
        question: sessionQuestion.questionSnapshot.question,
        userAnswer: answer,
        expectedAnswer: (question as any)?.expectedAnswer,
        detailedAnswer: question?.detailedAnswer,
        topic: sessionQuestion.questionSnapshot.topic,
        subtopic: sessionQuestion.questionSnapshot.subtopic,
        concepts: sessionQuestion.questionSnapshot.concepts,
        difficulty: sessionQuestion.questionSnapshot.difficulty,
        expectedAnswerDepth: (question as any)?.expectedAnswerDepth,
      });
    } catch (evalErr) {
      logger.warn('Answer evaluation failed', { error: (evalErr as Error).message });
    }

    const overallScore = evaluation ? evaluation.overallScore : 0.5;

    // Keep SessionQuestion in sync early: the calendar block and session
    // scoring below both read finalScore from it.
    sessionQuestion.finalScore = overallScore;
    if (evaluation) {
      sessionQuestion.evaluation = evaluation as any;
      sessionQuestion.aiAssessedScore = overallScore;
    }
    await sessionQuestion.save();

    // Create question history entry. (userId, questionId) is unique, so a
    // re-answer (e.g. a revision attempt of the same question) updates the
    // existing entry instead of failing on E11000.
    let historyEntry: any = null;
    try {
      historyEntry = await QuestionHistoryModel.create({
        userId: new mongoose.Types.ObjectId(userId),
        questionId: sessionQuestion.questionId,
        questionVersion: question?.version || 1,
        sessionId: new mongoose.Types.ObjectId(sessionId),
        isRevision: sessionQuestion.isRevision,
        revisionNumber: sessionQuestion.revisionNumber,
        questionSnapshot: { ...sessionQuestion.questionSnapshot, provenance: question?.provenance || 'CURATED', resumeRelevance: question?.resumeRelevance || 'LOW', expectedAnswerDepth: question?.expectedAnswerDepth || 'MODERATE' },
        answer: answer,
        answerTimeSeconds: sessionQuestion.answerTimeSeconds,
        answerSubmittedAt: new Date(),
        status: 'ANSWERED',
      });
    } catch (histErr: any) {
      if (histErr?.code === 11000) {
        historyEntry = await QuestionHistoryModel.findOneAndUpdate(
          {
            userId: new mongoose.Types.ObjectId(userId),
            questionId: sessionQuestion.questionId,
          },
          {
            $set: {
              answer,
              answerTimeSeconds: sessionQuestion.answerTimeSeconds,
              answerSubmittedAt: new Date(),
              status: 'ANSWERED',
              isRevision: sessionQuestion.isRevision,
              revisionNumber: sessionQuestion.revisionNumber,
            },
          },
          { new: true }
        );
      } else {
        throw histErr;
      }
    }

    // Attach the evaluation + concept tracking to the history entry
    if (evaluation && historyEntry) {
      historyEntry.evaluation = {
        overallScore: evaluation.overallScore,
        technicalCorrectness: evaluation.technicalCorrectness,
        completeness: evaluation.completeness,
        depth: evaluation.depth,
        clarity: evaluation.clarity,
        summary: evaluation.summary,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        missingPoints: evaluation.missingPoints,
        followUpSuggestions: evaluation.followUpSuggestions,
        improvementSuggestions: evaluation.improvementSuggestions,
        keyConceptsToRevise: evaluation.keyConceptsToRevise,
        strongerAnswerStructure: evaluation.strongerAnswerStructure,
        technicalGaps: evaluation.technicalGaps,
      };
      historyEntry.aiAssessedScore = evaluation.overallScore;
      historyEntry.finalScore = evaluation.overallScore;

      const testedConcepts = sessionQuestion.questionSnapshot.concepts || [];
      const weakConcepts = evaluation.keyConceptsToRevise.length
        ? evaluation.keyConceptsToRevise
        : overallScore < 0.7
          ? testedConcepts
          : [];
      const masteredConcepts = overallScore >= 0.7 ? testedConcepts : [];

      historyEntry.conceptsTested = [...new Set([...(historyEntry.conceptsTested || []), ...testedConcepts])];
      historyEntry.conceptsWeak = [...new Set([...(historyEntry.conceptsWeak || []), ...weakConcepts])];
      historyEntry.conceptsMastered = [...new Set([...(historyEntry.conceptsMastered || []), ...masteredConcepts])];
      if (evaluation.weaknesses?.length) {
        historyEntry.detectedWeaknesses = [
          ...new Set([...(historyEntry.detectedWeaknesses || []), ...evaluation.weaknesses.slice(0, 5)]),
        ];
      }
      if (evaluation.technicalGaps?.length) {
        historyEntry.detectedKnowledgeGaps = [
          ...new Set([...(historyEntry.detectedKnowledgeGaps || []), ...evaluation.technicalGaps]),
        ];
      }
      await historyEntry.save();
    }

    // Record in the user's date-wise calendar (questions asked today).
    // The question was already logged as 'presented' during session generation,
    // so update that entry in place; append only if it isn't on today's record.
    try {
      const entryType = sessionQuestion.questionSnapshot.isCoding
        ? 'coding'
        : sessionQuestion.questionSnapshot.isSystemDesign
          ? 'system_design'
          : sessionQuestion.questionSnapshot.isProjectInterview
            ? 'project'
            : sessionQuestion.isRevision
              ? 'revision'
              : 'technical';

      const updated = await calendarService.markEntryAnswered({
        userId,
        title: sessionQuestion.questionSnapshot.question,
        score: sessionQuestion.finalScore,
        answer: answer.slice(0, 500),
      });

      if (!updated) {
        await recordQuestionInDailyCalendar(userId, {
          type: entryType,
          title: sessionQuestion.questionSnapshot.question,
          topic: sessionQuestion.questionSnapshot.topic,
          subtopic: sessionQuestion.questionSnapshot.subtopic,
          concepts: sessionQuestion.questionSnapshot.concepts,
          difficulty: sessionQuestion.questionSnapshot.difficulty,
          status: 'answered',
          score: sessionQuestion.finalScore,
          answer: answer.slice(0, 500),
          metadata: sessionQuestion.isRevision
            ? { revisionNumber: sessionQuestion.revisionNumber }
            : undefined,
        });
      }
    } catch (calendarErr) {
      logger.warn('Failed to record answer in daily calendar', {
        error: (calendarErr as Error).message,
      });
    }

    // Update session/section aggregates with the real score
    try {
      const dailySession = await DailySession.findById(session._id);
      if (dailySession && typeof (dailySession as any).recordQuestionAnswer === 'function') {
        await (dailySession as any).recordQuestionAnswer(
          sessionQuestion._id,
          answer,
          sessionQuestion.answerTimeSeconds || 0,
          overallScore
        );
      }
    } catch (scoreErr) {
      logger.warn('Failed to update session aggregates', { error: (scoreErr as Error).message });
    }

    // ---------------- Spaced repetition: schedule weak answers for revision ----------------
    try {
      if (overallScore < 0.7 && historyEntry) {
        const existingActive = await (Revision as any).findActiveByQuestionHistoryId(historyEntry._id);
        if (existingActive) {
          // Already scheduled: push the due date forward to tomorrow so the
          // weak answer resurfaces soon.
          existingActive.dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
          existingActive.originalScore = Math.min(existingActive.originalScore ?? overallScore, overallScore);
          await existingActive.save();
          logger.info('Revision rescheduled for weak re-answer', { userId, revisionId: existingActive._id });
        } else {
          // createRevision needs originalQuestion._id; fall back to a shim
          // built from the snapshot when the Question doc is unavailable.
          const originalRef = question || {
            ...sessionQuestion.questionSnapshot,
            _id: sessionQuestion.questionId,
            archetype: sessionQuestion.questionSnapshot.archetype || '',
            interviewPriority: sessionQuestion.questionSnapshot.interviewPriority || '',
          };
          const revision = await (Revision as any).createRevision(
            new mongoose.Types.ObjectId(userId),
            historyEntry,
            originalRef
          );
          logger.info('Revision scheduled for weak answer', {
            userId,
            revisionId: revision?._id,
            score: overallScore,
            dueDate: revision?.dueDate,
          });
        }
      }

      // If this WAS a revision attempt, record it on the revision doc
      if (sessionQuestion.isRevision) {
        const activeRevision = await (Revision as any).findOne({
          userId: new mongoose.Types.ObjectId(userId),
          originalQuestionId: sessionQuestion.questionId,
          status: { $in: ['pending', 'due', 'in_progress'] },
        }).sort({ dueDate: 1 });

        if (activeRevision && typeof (activeRevision as any).complete === 'function') {
          const revisionEval = evaluation
            ? toRevisionEvaluation(
                evaluation,
                activeRevision.originalScore,
                activeRevision.currentEvaluation?.weaknesses || activeRevision.originalQuestionSnapshot?.concepts || []
              )
            : {
                overallScore,
                improved: false,
                delta: 0,
                summary: 'Revision completed (heuristic scoring).',
                strengths: [],
                weaknesses: [],
                missingPoints: [],
                improvementSuggestions: [],
                keyConceptsToRevise: [],
                previousWeaknessesAddressed: [],
                newWeaknesses: [],
              };

          // Each attempt counts as one revision pass (schedule is +1/+7/+30)
          activeRevision.currentRevisionNumber = (activeRevision.currentRevisionNumber || 0) + 1;
          await (activeRevision as any).complete(answer, sessionQuestion.answerTimeSeconds || 0, revisionEval);

          // Re-queue for the next spaced pass unless fully mastered —
          // complete() sets status 'completed'; the generator only picks up
          // pending/due, so reschedule explicitly.
          if (!activeRevision.isMastered && activeRevision.nextRevisionDate) {
            activeRevision.status = 'pending';
            activeRevision.dueDate = activeRevision.nextRevisionDate;
            await activeRevision.save();
          }

          logger.info('Revision attempt recorded', {
            userId,
            revisionId: activeRevision._id,
            score: overallScore,
            isMastered: activeRevision.isMastered,
          });
        }
      }
    } catch (revErr) {
      // Never fail the answer submission over revision bookkeeping
      logger.warn('Revision scheduling failed', { error: (revErr as Error).message });
    }

    // ---------------- Skill graph: real, evaluation-driven updates ----------------
    try {
      if (evaluation) {
        const sg = await (SkillGraph as any).upsertForUser(new mongoose.Types.ObjectId(userId));
        const correct = overallScore >= 0.7;

        // Topic-level update
        await sg.updateSkill(
          sessionQuestion.questionSnapshot.topic,
          correct,
          overallScore,
          sessionQuestion.questionSnapshot.topic,
          undefined, // concepts handled below, one call each
          sessionQuestion.questionSnapshot.archetype || (question as any)?.archetype || ''
        );

        // Concept-level updates (per concept, with the real score)
        const conceptsToUpdate = (sessionQuestion.questionSnapshot.concepts || [])
          .slice(0, 6);
        for (const concept of conceptsToUpdate) {
          await sg.updateConcept(concept, correct, overallScore);
        }
      }
    } catch (sgErr) {
      logger.warn('Skill graph update failed', { error: (sgErr as Error).message });
    }

    return {
      sessionQuestionId: sessionQuestion._id,
      message: 'Answer submitted successfully',
      score: overallScore,
      evaluationSource: evaluation?.source || 'none',
      evaluation: evaluation
        ? {
            overallScore: evaluation.overallScore,
            summary: evaluation.summary,
            strengths: evaluation.strengths,
            weaknesses: evaluation.weaknesses,
            missingPoints: evaluation.missingPoints,
            improvementSuggestions: evaluation.improvementSuggestions,
            keyConceptsToRevise: evaluation.keyConceptsToRevise,
            strongerAnswerStructure: evaluation.strongerAnswerStructure,
          }
        : null,
      scheduledForRevision: overallScore < 0.7,
      referenceAnswer: question?.detailedAnswer || (question as any)?.expectedAnswer || null,
    };
  },

  // Mark session as complete
  async completeSession(sessionId: string, userId: string): Promise<any> {
    const session = await DailySession.findById(new mongoose.Types.ObjectId(sessionId));

    if (!session || session.userId.toString() !== userId) {
      throw new NotFoundError('Session not found');
    }

    if (session.status === 'completed') return session;
    session.totalTimeSeconds = Math.floor(
      (Date.now() - new Date(session.createdAt).getTime()) / 1000
    );
    const claimed = await DailySession.findOneAndUpdate({_id:session._id,status:{$ne:'completed'}},
      {$set:{status:'completed',completedAt:new Date(),totalTimeSeconds:session.totalTimeSeconds}},{new:true});
    if (!claimed) return DailySession.findById(session._id);
    session.status='completed';session.completedAt=claimed.completedAt;

    // Update user progress
    const UserProgress = mongoose.model('UserProgress');
    await (UserProgress as any).upsertForUser(new mongoose.Types.ObjectId(userId)).then(
      (up) => {
        up.totalQuestions += session.totalQuestions;
        up.answeredQuestions += session.completedQuestions;
        up.totalStudyTimeSeconds += session.totalTimeSeconds || 0;
        up.daysActive += 1;
        up.lastActiveDate = new Date();
        return up.save();
      }
    );

    return session;
  },

  // Get session history
  async getSessionHistory(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<any> {
    const { page = 1, limit = 10, startDate, endDate } = options;

    const query: any = {
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    };

    if (startDate) {
      query.sessionDate = { ...query.sessionDate, $gte: startDate };
    }
    if (endDate) {
      query.sessionDate = { ...query.sessionDate, $lte: endDate };
    }

    const sessions = await DailySession.find(query)
      .sort({ sessionDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('sessionDate userDayNumber status totalQuestions completedQuestions averageScore')
      .lean();

    const total = await DailySession.countDocuments(query);

    return {
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
