import { randomUUID } from 'crypto';
import { z } from 'zod';
import { structuredAI } from '../../common/services/structured-ai';
import { hasAI } from '../../common/services/ai-provider';

import { generatePersonalizedQuestions, generateCodingQuestions, reserveQuestion, exposedQuestionIds } from '../questions/personalized-generator';
import mongoose from 'mongoose';
import config from '../../config';
import logger from '../../config/logger';
import { DailySession, SessionQuestion } from './daily-session.model';
import { Question } from '../questions/question.model';
import { QuestionHistory as QuestionHistoryModel } from '../questions/question-history.model';
import { Revision } from '../revisions/revision.model';
import ResumeProfile from '../resume/resume-profile.model';
import { buildDailyPlan } from '../profile/daily-plan';
import InterviewProfile from '../profile/interview-profile.model';
import SkillGraph from '../skill-graph/skill-graph.model';
import { NotFoundError, ConflictError, InternalError, RateLimitError } from '../../common/filters/error-filter';
import { QuestionType, Difficulty, Provenance } from '../questions/question.model';
import { calendarService, recordQuestionInDailyCalendar, recomputeTotals } from '../calendar/calendar.service';
import DailyRecord from '../calendar/daily-record.model';
import {
  evaluateAnswer,
  toRevisionEvaluation,
  getOpenAIClient,
  EvaluationResult,
} from '../evaluation/answer-evaluation';

const interviewAnswerSchema = z.object({
  direct:z.string().min(20).max(500),
  questionFocus:z.string().min(15).max(350),
  why:z.string().min(25).max(750),
  how:z.string().min(35).max(1000),
  example:z.string().min(35).max(850),
  tradeOff:z.string().min(25).max(750),
  summary:z.string().min(20).max(350),
});

// Rich, interview-ready detailed answer with depth suitable for Senior-level prep.
const interviewAnswerDetailedSchema = z.object({
  overview:z.string().min(40).max(1200),
  keyPoints:z.array(z.string().min(8).max(250)).min(3).max(10),
  algorithmOrApproach:z.string().min(40).max(1500),
  complexity:z.string().min(20).max(500),
  codeSketch:z.string().min(20).max(1500).optional(),
  edgeCases:z.array(z.string().min(8).max(250)).min(1).max(6),
  commonMistakes:z.array(z.string().min(8).max(250)).min(1).max(6),
  whyItMatters:z.string().min(30).max(700),
  followUpQuestions:z.array(z.string().min(10).max(250)).min(1).max(5),
  summary:z.string().min(20).max(400),
});

const SESSION_TYPE_TO_CALENDAR: Record<string, string> = {
  technical: 'technical', system_design: 'system_design', coding: 'coding',
  project: 'project', revision: 'revision', mock_interview: 'mock_interview',
  behavioral: 'behavioral', custom: 'custom',
};

/**
 * Attach every question in a session to the user's daily calendar record so
 * spaced revision can schedule it. Idempotent by normalized title: calling this
 * again after a regeneration appends only genuinely new questions, so repeated
 * regenerations never inflate a day's totals. Entries for questions that were
 * later replaced are intentionally left in place as history.
 */
export async function syncSessionToCalendar(
  userId: string,
  sessionId: mongoose.Types.ObjectId,
  occurredAt: Date
): Promise<number> {
  try {
    const sessionQuestions = await SessionQuestion.find({ sessionId }).sort({ order: 1 }).lean();
    if (!sessionQuestions.length) return 0;
    const { record } = await DailyRecord.findOrCreateForDate(new mongoose.Types.ObjectId(userId), occurredAt);
    const normalize = (t?: string) => (t || '').trim().toLowerCase();
    const existing = new Set((record.entries || []).map((e: any) => normalize(e.title)));
    let added = 0;
    for (const sq of sessionQuestions) {
      const snapshot = (sq as any).questionSnapshot || {};
      const title = (snapshot.question || '').trim();
      if (!title || existing.has(normalize(title))) continue;
      const entry: any = {
        _id: new mongoose.Types.ObjectId(),
        type: snapshot.isCoding ? 'coding'
          : snapshot.isSystemDesign ? 'system_design'
          : snapshot.isProjectInterview ? 'project'
          : sq.isRevision ? 'revision'
          : SESSION_TYPE_TO_CALENDAR[(sq as any).sectionType] || 'technical',
        title: title.slice(0, 1000),
        topic: snapshot.topic,
        subtopic: snapshot.subtopic,
        concepts: snapshot.concepts,
        difficulty: snapshot.difficulty,
        // Reflect real progress: a regenerated question starts unanswered.
        status: sq.status === 'answered' ? 'answered' : sq.status === 'skipped' ? 'skipped' : 'presented',
        count: 1,
        occurredAt,
        metadata: { sessionQuestionId: String(sq._id) },
      };
      if (typeof sq.finalScore === 'number') entry.score = sq.finalScore;
      record.entries.push(entry);
      existing.add(normalize(title));
      added++;
    }
    if (added) {
      recomputeTotals(record);
      await record.save();
    }
    if (added) logger.info('Synced session questions to daily calendar', { userId, sessionId: String(sessionId), added });
    return added;
  } catch (error) {
    // A calendar problem must never fail session generation.
    logger.warn('Failed to sync session to daily calendar', {
      userId, sessionId: String(sessionId), error: (error as Error).message,
    });
    return 0;
  }
}

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

    // Attach every question to the calendar for spaced revision (idempotent).
    await syncSessionToCalendar(userId, session._id, session.sessionDate || date);

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
    const sectionFailures:{ topic?: string; title?: string; message: string }[] = [];
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
      // Sections are identified by type+topic, not title: plan titles are generated
      // and change when preferences change, which used to orphan the existing
      // section and leave the day showing two sections for the same topic.
      const sameSection = (s:any) => s.type === planned.type && s.topic === planned.topic;
      let section = session.sections.find(sameSection);
      if (!section) {
        session.sections.push({ _id:new mongoose.Types.ObjectId(), type:planned.type,
          title:planned.title, topic:planned.topic, order:session.sections.length, status:'pending',
          totalQuestions:0, completedQuestions:0, questions:[],
          description:'Personalized from confirmed facts and your preferences' });
        await session.save();
        section = session.sections[session.sections.length-1];
      } else if (section.title !== planned.title) {
        // Keep the user's progress but adopt the current plan's wording.
        section.title = planned.title;
        session.markModified('sections');
        await session.save();
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
        // Also exclude anything already exposed via QuestionExposure (skip/
        // regenerate paths), so a skipped problem never resurfaces.
        const exposed = await exposedQuestionIds(userId);
        const bankSize = await mongoose.model('CodingProblem').countDocuments({});
        const problemCandidates = await mongoose.model('CodingProblem').find({
          isHidden:false,isDeprecated:false,isInterviewRelevant:true,
          _id:{ $nin:priorQuestions.map(q=>q.sourceId).filter(Boolean) },
        }).limit(needed + exposed.size).lean();
        const problems = problemCandidates.filter((p:any)=>!exposed.has(String(p._id))).slice(0, needed);
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
        // The curated bank is the preferred source, but it is seeded data. When it
        // cannot cover the quota (an unseeded install, or every candidate already
        // served), fall back to AI so the user's coding count is honoured instead
        // of leaving a hole in the day.
        const stillNeeded = planned.count - section.totalQuestions;
        if (stillNeeded > 0) {
          try {
            const generated = await generateCodingQuestions(userId, planned.topic, stillNeeded, sessionId);
            for (const question of generated) await add(question);
          } catch (error) {
            sectionFailures.push({ topic:planned.topic, title:planned.title, message:(error as Error).message });
            logger.warn('Coding question generation failed', { userId, topic:planned.topic,
              bankSize, error:(error as Error).message });
          }
          if (section.totalQuestions === 0) {
            section.notes = bankSize === 0
              ? 'The curated coding bank is empty on this install and the AI coding fallback produced nothing. Run "npm run seed:coding" in the backend folder, or set an AI provider key in Settings.'
              : 'No unused coding problems are left in the curated bank and the AI coding fallback produced nothing. Seed more coding problems or retry later.';
          }
        }
      } else {
        // One unfillable topic must not void the whole day: record why and let
        // the remaining sections generate, so the user still gets practice.
        try {
          const questions = await generatePersonalizedQuestions(userId,planned.topic,needed,planned.type,sessionId);
          for (const question of questions) await add(question);
        } catch (error) {
          sectionFailures.push({ topic:planned.topic, title:planned.title, message:(error as Error).message });
          logger.warn('Section question generation failed', { userId, topic:planned.topic,
            error:(error as Error).message, code:(error as any)?.code });
        }
      }
      if (planned.type === 'project' && !interviewProfile.confirmedProjects?.length && section.totalQuestions > 0)
        section.notes = 'No confirmed resume projects yet, so these are portfolio-style prompts rather than questions about your own work. Confirm a project to make them resume-specific.';
      if (section.totalQuestions < planned.count && !section.notes) section.notes =
        `Only ${section.totalQuestions} of ${planned.count} questions could be generated — no repeats were inserted. Widen your topics, set difficulty to Mixed, or press Regenerate later.`;
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
    if (sectionFailures.length) {
      const last = session.sections[session.sections.length-1];
      if (last && !last.notes) last.notes = sectionFailures[0].message;
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

  /**
   * Generate a rich detailed answer guide from a question + its short answer.
   * Used when the short answer is already cached but the detailed guide was not.
   * Also generates the detailed answer when the short answer is already cached.
   */
  async getInterviewAnswer(sessionId: string, mappingId: string, userId: string): Promise<{
    sections?: z.infer<typeof interviewAnswerSchema>; legacyAnswer?: string; detailed?: z.infer<typeof interviewAnswerDetailedSchema>;
  }> {
    const session = await DailySession.findOne({ _id:sessionId, userId, isDeleted:false });
    if (!session) throw new NotFoundError('Session not found');
    const mapped = await SessionQuestion.findOne({ _id:mappingId, sessionId });
    if (!mapped) throw new NotFoundError('Question not found in session');
    const question = await Question.findById(mapped.questionId);
    if (!question) throw new NotFoundError('Question not found');
    if (mapped.status === 'pending') {
      await SessionQuestion.updateOne({ _id:mapped._id, status:'pending' }, { $set:{ status:'presented' } });
    }
    const cached = interviewAnswerSchema.safeParse(question.interviewAnswerSections);
    const cachedDetailed = question.interviewAnswerDetailed != null;
    if (cached.success && cachedDetailed) return { sections:cached.data, detailed:question.interviewAnswerDetailed };
    if (cached.success && !cachedDetailed) {
      // Have the short answer but not the detailed one: generate detailed from cache.
      const detailed = await this.generateDetailedAnswer(userId, mapped, question, cached.data);
      await Question.updateOne({ _id:question._id }, { $set:{ interviewAnswerDetailed:detailed } });
      return { sections:cached.data, detailed };
    }
    const reference = question.interviewAnswer || question.detailedAnswer || question.shortAnswer || question.codingProblem?.solutionCode || '';
    if (!hasAI()) {
      if (reference) {
        // No AI provider configured: return the cached answer as plain text.
        // The detailed answer from generation is stored on the question model
        // and is shown to the user as the legacy answer.
        return { legacyAnswer: reference };
      }
      throw new NotFoundError('An answer is not available for this question yet');
    }
    const shortSystemPrompt = 'Write a technically accurate, standard interview answer to the exact question. The direct field MUST answer the question in its first sentence. questionFocus defines the key terms and what the interviewer is asking. why gives the rationale. how explains concrete steps or mechanism. example gives one specific hypothetical scenario. tradeOff names a real limitation and when an alternative fits. summary closes in one sentence. Keep the spoken answer (direct, why, how, example, tradeOff, summary) about 140-200 words total, suitable for 60-90 seconds. Use a real number only if the reference supplies one; do not fabricate metrics or personal experience. Correct technical mistakes in the reference. Do not claim that the candidate implemented a system unless verified. For coding questions cover the algorithm, complexity and an edge case across the fields. Return a JSON object with string fields direct, questionFocus, why, how, example, tradeOff, summary.';
    const detailedSystemPrompt = 'You are a senior technical interviewer preparing a candidate for a ' + (question.difficulty || 'intermediate') + ' ' + (question.questionType || 'technical') + ' interview question. Produce a complete, interview-ready detailed answer guide for the candidate to study. The answer must be technically accurate, specific, and suitable for a candidate targeting a Senior-level role. Do not claim the candidate implemented anything unless the reference says so. Cover the following in the fields below: - overview: a concise 2-4 sentence explanation of the core idea or approach. - keyPoints: 3-10 bullet-style statements capturing the essential concepts, mechanisms, or principles. - algorithmOrApproach: a step-by-step explanation of the algorithm, architecture, or reasoning approach. - complexity: time and space complexity (for coding), or key design trade-offs and scaling considerations (for system design). - codeSketch: for coding questions, a short pseudocode or language-agnostic sketch of the core approach (omit for non-coding). - edgeCases: 1-6 specific edge cases or pitfalls that a strong candidate should mention. - commonMistakes: 1-6 mistakes or weak answers that interviewers commonly see. - whyItMatters: why this question is asked and what it reveals about the candidate. - followUpQuestions: 1-5 likely follow-up questions the interviewer may ask. - summary: a one-sentence takeaway. Keep the full detailed answer focused and concrete; avoid filler and generic statements. Return a JSON object matching the schema exactly.';
    const [shortResult, detailedResult] = await Promise.all([
      structuredAI({ userId, purpose:'interview-answer', version:'answer-v2',
        schema:interviewAnswerSchema,
        context:{ question:mapped.questionSnapshot.question, reference, concepts:question.concepts,
          difficulty:question.difficulty, type:question.questionType },
        system:shortSystemPrompt,
      }),
      structuredAI({ userId, purpose:'interview-answer-detailed', version:'answer-detailed-v1',
        schema:interviewAnswerDetailedSchema,
        context:{ question:mapped.questionSnapshot.question, reference, concepts:question.concepts,
          difficulty:question.difficulty, type:question.questionType, shortAnswer:null },
        system:detailedSystemPrompt,
      }),
    ]);
    await Question.updateOne({ _id:question._id }, { $set:{
      interviewAnswerSections:shortResult,
      interviewAnswerDetailed:detailedResult,
    } });
    return { sections:shortResult, detailed:detailedResult };
  },
  async generateDetailedAnswer(
    userId: string,
    mapped: any,
    question: any,
    shortAnswer: any,
  ): Promise<any> {
    if (question.interviewAnswerDetailed) return question.interviewAnswerDetailed;
    const reference = question.interviewAnswer || question.detailedAnswer || question.shortAnswer || question.codingProblem?.solutionCode || '';
    const systemPrompt = [
      'You are a senior technical interviewer preparing a candidate for a ',
      question.difficulty || 'intermediate',
      ' ',
      question.questionType || 'technical',
      ' interview question. Produce a complete, interview-ready detailed answer guide for the candidate to study. The answer must be technically accurate, specific, and suitable for a candidate targeting a Senior-level role.',
      'Do not claim the candidate implemented anything unless the reference says so.',
      'Use the short answer below as a starting point and expand it into a richer study guide.',
      'Cover the following in the fields below:',
      '- overview: a concise 2-4 sentence explanation of the core idea or approach.',
      '- keyPoints: 3-10 bullet-style statements capturing the essential concepts, mechanisms, or principles.',
      '- algorithmOrApproach: a step-by-step explanation of the algorithm, architecture, or reasoning approach.',
      '- complexity: time and space complexity (for coding), or key design trade-offs and scaling considerations (for system design).',
      '- codeSketch: for coding questions, a short pseudocode or language-agnostic sketch of the core approach (omit for non-coding).',
      '- edgeCases: 1-6 specific edge cases or pitfalls that a strong candidate should mention.',
      '- commonMistakes: 1-6 mistakes or weak answers that interviewers commonly see.',
      '- whyItMatters: why this question is asked and what it reveals about the candidate.',
      '- followUpQuestions: 1-5 likely follow-up questions the interviewer may ask.',
      '- summary: a one-sentence takeaway.',
      'Keep the full detailed answer focused and concrete; avoid filler and generic statements.',
      'Return a JSON object matching the schema exactly.',
    ].join(' ');
    const result = await structuredAI({ userId, purpose:'interview-answer-detailed', version:'answer-detailed-v1',
      schema:interviewAnswerDetailedSchema,
      context:{ question:mapped.questionSnapshot.question, reference, concepts:question.concepts,
        difficulty:question.difficulty, type:question.questionType, shortAnswer },
      system:systemPrompt,
    });
    await Question.updateOne({ _id:question._id }, { $set:{ interviewAnswerDetailed:result } });
    return result;
  },
  async markQuestionReviewed(sessionId: string, mappingId: string, userId: string): Promise<number> {
    const session = await DailySession.findOne({ _id:sessionId, userId, isDeleted:false });
    if (!session) throw new NotFoundError('Session not found');
    const mapped = await SessionQuestion.findOneAndUpdate({ _id:mappingId, sessionId,
      status:'presented' }, { $set:{ status:'reviewed' } }, { new:true });
    if (!mapped && !await SessionQuestion.exists({ _id:mappingId, sessionId })) {
      throw new NotFoundError('Question not found in session');
    }
    if (!mapped && !await SessionQuestion.exists({ _id:mappingId, sessionId, status:{$in:['reviewed','answered']} })) {
      throw new ConflictError('Reveal the answer before marking this question reviewed');
    }
    return this.recomputeSessionAggregates(session);
  },

  /**
   * Skip a pending/presented question. It stays visible in the session for
   * transparency but counts as resolved, never blocks completion, and does not
   * affect scores. Re-answering later is still allowed via submitAnswer.
   */
  async skipQuestion(sessionId: string, mappingId: string, userId: string): Promise<any> {
    const session = await DailySession.findOne({ _id:sessionId, userId, isDeleted:false });
    if (!session) throw new NotFoundError('Session not found');
    const mapped = await SessionQuestion.findOneAndUpdate({ _id:mappingId, sessionId,
      status:{$in:['pending','presented']} }, { $set:{ status:'skipped' } }, { new:true });
    if (!mapped) {
      if (!await SessionQuestion.exists({ _id:mappingId, sessionId })) {
        throw new NotFoundError('Question not found in session');
      }
      throw new ConflictError('Answered or reviewed questions cannot be skipped');
    }
    await this.recomputeSessionAggregates(session);
    return { questionId:mapped._id, status:'skipped' };
  },

  /**
   * Recompute section/session progress from SessionQuestion statuses.
   * Answered and reviewed count as completed; skipped counts as resolved so it
   * never blocks section completion, but is excluded from score aggregates.
   */
  async recomputeSessionAggregates(session: any): Promise<number> {
    // Reload before saving: callers may hold a stale version after other
    // writes to the same session document.
    const target = (await DailySession.findById(session._id)) || session;
    const all = await SessionQuestion.find({ sessionId:target._id }).select('_id sectionId status finalScore').lean();
    const answered = all.filter(q=>q.status==='answered');
    for (const section of target.sections) {
      const entries = all.filter(q=>String(q.sectionId)===String(section._id));
      section.completedQuestions = entries.filter(q=>['answered','reviewed','skipped'].includes(q.status)).length;
      section.status = section.totalQuestions > 0 && section.completedQuestions >= section.totalQuestions ? 'completed':'pending';
    }
    target.completedQuestions = all.filter(q=>['answered','reviewed','skipped'].includes(q.status)).length;
    target.correctQuestions = answered.filter(q=>(q.finalScore || 0)>=0.7).length;
    target.averageScore = answered.length ? answered.reduce((sum,q)=>sum+(q.finalScore || 0),0)/answered.length : 0;
    await target.save();
    return target.completedQuestions;
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

  /**
   * Replace all pending/presented questions in today's session with a fresh
   * set, leaving answered/reviewed/skipped questions and section structure
   * intact. Refreshes the daily plan from the user's latest preferences so
   * changed settings take effect on today's session immediately.
   */
  async regenerateTodaySession(userId: string, date: Date = new Date()): Promise<any> {
    const session = await DailySession.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      sessionDate: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
      isDeleted: false,
    });
    if (!session) throw new NotFoundError('No session for today yet. Generate it first.');
    if (session.generationState === 'generating') {
      throw new ConflictError('Session generation is already in progress. Reload shortly.');
    }
    const interviewProfile = await InterviewProfile.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!interviewProfile?.onboardingCompleted) {
      throw new NotFoundError('Interview profile not found. Please complete onboarding first.');
    }

    // Rebuild the plan from the latest preferences using the same builder the
    // settings page and onboarding use, so every configured section is present.
    const nextPlan = buildDailyPlan({
      preferences: interviewProfile.preferences,
      confirmedSkills: interviewProfile.confirmedSkills,
      confirmedProjects: interviewProfile.confirmedProjects,
      currentRole: interviewProfile.targetRole,
    });
    if (nextPlan.length && JSON.stringify(nextPlan) !== JSON.stringify(interviewProfile.dailyPlan || [])) {
      interviewProfile.dailyPlan = nextPlan;
      interviewProfile.markModified('dailyPlan');
      await interviewProfile.save();
    }

    // Remove only unrevealed questions; answered/reviewed/skipped stay for the record.
    const pending = await SessionQuestion.find({ sessionId:session._id, status:{$in:['pending','presented']} })
      .select('_id').lean();
    if (pending.length) {
      const pendingIds = new Set(pending.map((p:any)=>String(p._id)));
      await SessionQuestion.deleteMany({ _id:{ $in:[...pendingIds] } });
      const fresh = await DailySession.findById(session._id);
      if (fresh) {
        for (const section of fresh.sections) {
          const kept = section.questions.filter((id:any)=>!pendingIds.has(String(id)));
          if (kept.length === section.questions.length) continue;
          section.questions = kept;
          section.totalQuestions = kept.length;
          section.notes = undefined;
          section.completedQuestions = Math.min(section.completedQuestions, kept.length);
          if (kept.length === 0) section.status = 'pending';
        }
        fresh.markModified('sections');
        await fresh.save();
      }
    }

    // Drop sections the user has since zeroed out, so a slider at 0 really
    // removes that section from today. Anything with recorded work is kept.
    const plannedKeys = new Set(nextPlan.map((p:any)=>`${p.type}::${p.topic}`));
    const staleSectionIds:string[] = [];
    for (const s of session.sections as any[]) {
      if (plannedKeys.has(`${s.type}::${s.topic}`)) continue;
      const worked = await SessionQuestion.exists({ sessionId:session._id, sectionId:s._id,
        status:{ $nin:['pending','presented'] } });
      if (!worked) staleSectionIds.push(String(s._id));
    }
    if (staleSectionIds.length) {
      const stale = await DailySession.findById(session._id);
      if (stale) {
        const staleQuestionIds = (stale.sections as any[])
          .filter((s:any)=>staleSectionIds.includes(String(s._id)))
          .flatMap((s:any)=>(s.questions||[]).map((id:any)=>String(id)));
        if (staleQuestionIds.length) await SessionQuestion.deleteMany({ _id:{ $in:staleQuestionIds } });
        stale.sections = (stale.sections as any[]).filter((s:any)=>!staleSectionIds.includes(String(s._id)));
        stale.markModified('sections');
        await stale.save();
      }
    }

    // Refill from the (possibly rewritten) plan via the same lease machinery
    // as first generation; a failure marks the session so the UI can retry.
    const owner = randomUUID();
    const refreshed = await DailySession.findOneAndUpdate({ _id:session._id, generationState:{$ne:'generating'} }, {
      $set:{ generationState:'generating', generationOwner:owner, generationStartedAt:new Date(),
        generationMessage:'Regenerating questions with your latest settings', status:'pending' },
      $unset:{ completedAt:1 },
    }, { new:true });
    if (!refreshed) throw new ConflictError('Session generation is already in progress. Reload shortly.');
    try {
      const skillGraph = await SkillGraph.findOne({ userId: new mongoose.Types.ObjectId(userId) });
      const dueRevisions = await Revision.find({
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: ['pending', 'due'] },
        dueDate: { $lte: date },
      }).sort({ dueDate: 1 });
      const sections = await this.generateSections(refreshed._id, userId, interviewProfile, skillGraph, dueRevisions, date);
      refreshed.sections = sections as any;
      refreshed.totalQuestions = sections.reduce((sum:number,s:any)=>sum+s.totalQuestions,0);
      refreshed.generationState = 'completed';
      const blocked = (sections as any[]).filter((s:any)=>s.notes).map((s:any)=>s.notes);
      refreshed.generationMessage = refreshed.totalQuestions === 0
        ? (blocked[0] || 'No new questions were generated. Check your AI provider settings or expand your topics, then retry.')
        : blocked.length ? 'Some sections contain fewer questions; no repeats were inserted.' : undefined;
      await DailySession.updateOne({ _id:refreshed._id }, { $set:{
        sections:refreshed.sections, totalQuestions:refreshed.totalQuestions,
        generationState:'completed', generationMessage:refreshed.generationMessage,
      } });
      await this.recomputeSessionAggregates(refreshed);
      // Regenerated questions must reach the calendar too, otherwise they never
      // enter the spaced-revision schedule.
      await syncSessionToCalendar(userId, refreshed._id, refreshed.sessionDate || date);
      return refreshed;
    } catch (error) {
      await DailySession.updateOne({ _id:refreshed._id }, {
        $set:{ generationState:'failed', generationMessage:(error as any)?.isOperational
          ? (error as Error).message
          : 'Regeneration failed. Check your AI provider settings, then retry.' },
        $unset:{ generationOwner:1 },
      });
      throw error;
    }
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
    const writtenAnswers = await SessionQuestion.countDocuments({ sessionId:session._id, status:'answered' });
    await (UserProgress as any).upsertForUser(new mongoose.Types.ObjectId(userId)).then(
      (up) => {
        up.totalQuestions += session.totalQuestions;
        up.answeredQuestions += writtenAnswers;
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
