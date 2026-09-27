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
import { NotFoundError, ConflictError, InternalError } from '../../common/filters/error-filter';
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
  async generateDailySession(userId: string, date: Date = new Date()): Promise<any> {
    // Check if session already exists (idempotency)
    const existingSession = await DailySession.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      sessionDate: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      },
      isDeleted: false,
    });

    if (existingSession) {
      return existingSession;
    }

    // Load user profile and data
    const interviewProfile = await InterviewProfile.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!interviewProfile) {
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

    // Create session
    const session = await DailySession.create({
      userId: new mongoose.Types.ObjectId(userId),
      sessionDate: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      userDayNumber: dayNumber,
      status: 'pending',
      interviewProfileSnapshot: {
        experienceLevel: interviewProfile.experienceLevel,
        targetRole: interviewProfile.targetRole,
        targetCompanies: interviewProfile.targetCompanies,
        primaryLanguages: interviewProfile.primaryLanguages,
        frameworks: interviewProfile.frameworks,
        databases: interviewProfile.databases,
        systemDesignLevel: interviewProfile.systemDesignLevel,
      },
      revisionsDue: dueRevisions.length,
    });

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
    session.totalQuestions = sections.reduce((sum, s) => sum + s.totalQuestions, 0);
    await session.save();

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
    const sections: any[] = [];
    let sectionOrder = 0;

    // 1. Revision section
    if (dueRevisions.length > 0) {
      const revisionSection = await this.generateRevisionSection(
        sessionId,
        userId,
        dueRevisions,
        sectionOrder++
      );
      sections.push(revisionSection);
    }

    // 2. Technical section (main questions)
    const technicalSection = await this.generateTechnicalSection(
      sessionId,
      userId,
      interviewProfile,
      skillGraph,
      sectionOrder++
    );
    sections.push(technicalSection);

    // 3. System design section
    const systemDesignSection = await this.generateSystemDesignSection(
      sessionId,
      userId,
      interviewProfile,
      skillGraph,
      sectionOrder++
    );
    sections.push(systemDesignSection);

    // 4. Coding section
    const codingSection = await this.generateCodingSection(
      sessionId,
      userId,
      interviewProfile,
      skillGraph,
      sectionOrder++
    );
    sections.push(codingSection);

    // 5. Project interview section
    const projectSection = await this.generateProjectSection(
      sessionId,
      userId,
      interviewProfile,
      sectionOrder++
    );
    sections.push(projectSection);

    return sections;
  },

  // Generate revision section
  async generateRevisionSection(
    sessionId: mongoose.Types.ObjectId,
    userId: string,
    revisions: any[],
    order: number
  ): Promise<any> {
    const sectionQuestions: any[] = [];

    for (const revision of revisions.slice(0, 10)) {
      const questionHistory = await QuestionHistoryModel.findById(revision.questionHistoryId);
      if (!questionHistory) continue;

      const question = await Question.findById(revision.originalQuestionId);
      if (!question) continue;

      const sessionQuestion = await SessionQuestion.create({
        sessionId,
        questionId: question._id,
        sectionId: new mongoose.Types.ObjectId(), // Will be set after section creation
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
      _id: new mongoose.Types.ObjectId(),
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

  // Generate technical section
  async generateTechnicalSection(
    sessionId: mongoose.Types.ObjectId,
    userId: string,
    interviewProfile: any,
    skillGraph: any,
    order: number
  ): Promise<any> {
    const userPreferences = interviewProfile.preferences;

    // Select topic for today
    const selectedTopic = await this.selectTopicForDay(
      userId,
      interviewProfile,
      skillGraph
    );

    // Determine difficulty distribution from the user's difficulty choice
    const total = Math.max(1, Math.min(userPreferences.dailyQuestions || 10, 50));
    const difficultyDist = this.getDifficultyDistribution(userPreferences.difficulty, total);

    const sectionQuestions: any[] = [];

    // Get questions for topic
    const questions = await this.selectQuestionsForTopic(
      userId,
      selectedTopic,
      difficultyDist,
      userPreferences.excludedTopics || [],
      total
    );

    for (const question of questions) {
      const sessionQuestion = await SessionQuestion.create({
        sessionId,
        questionId: question._id,
        sectionId: new mongoose.Types.ObjectId(),
        order: sectionQuestions.length,
        isRevision: false,
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
      _id: new mongoose.Types.ObjectId(),
      type: 'technical',
      title: selectedTopic.name,
      description: `Technical questions on ${selectedTopic.name}`,
      order,
      status: 'pending',
      totalQuestions: sectionQuestions.length,
      completedQuestions: 0,
      questions: sectionQuestions.map(q => q._id),
      topic: selectedTopic.name,
      subtopic: selectedTopic.subtopics?.[0] || '',
    };
  },

  /**
   * Build the difficulty distribution for a session from the user's single
   * difficulty choice. 'mixed' keeps the legacy blend; anything else produces
   * questions of that difficulty ONLY (mapped: extra_hard -> EXPERT).
   */
  getDifficultyDistribution(
    difficulty: string | undefined,
    total: number
  ): { EASY: number; MEDIUM: number; HARD: number; EXPERT: number } {
    switch (difficulty) {
      case 'easy':
        return { EASY: total, MEDIUM: 0, HARD: 0, EXPERT: 0 };
      case 'medium':
        return { EASY: 0, MEDIUM: total, HARD: 0, EXPERT: 0 };
      case 'hard':
        return { EASY: 0, MEDIUM: 0, HARD: total, EXPERT: 0 };
      case 'extra_hard':
        return { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: total };
      case 'mixed':
      default:
        return {
          EASY: Math.ceil(total * 0.2),
          MEDIUM: Math.ceil(total * 0.5),
          HARD: Math.ceil(total * 0.2),
          EXPERT: Math.ceil(total * 0.1),
        };
    }
  },

  // Select topic for the day
  async selectTopicForDay(
    userId: string,
    interviewProfile: any,
    skillGraph: any
  ): Promise<any> {
    // Get all topics
    const topics = await mongoose.model('Topic').find({ isCore: true }).lean();

    if (topics.length === 0) {
      // Fallback topic
      return {
        _id: 'java',
        name: 'Java',
        description: 'Java fundamentals and advanced concepts',
        category: 'programming_language',
        interviewPriority: 'very_high',
        isCore: true,
        subtopics: ['Collections', 'JVM', 'Concurrency', 'Streams'],
      };
    }

    // Score topics based on:
    // - Weak areas in skill graph
    // - Time since last studied
    // - Resume relevance
    // - Interview priority
    // - Recent exposure

    const scoredTopics = topics.map(topic => {
      let score = 0;

      // Interview priority weight
      const priorityMap = { low: 1, medium: 2, high: 3, very_high: 4 };
      score += (priorityMap[topic.interviewPriority as keyof typeof priorityMap] || 2) * 10;

      // Resume relevance
      if (interviewProfile.primaryLanguages.some(l =>
        l.toLowerCase() === topic.name.toLowerCase()
      )) {
        score += 15;
      }

      // Weak areas from skill graph
      if (skillGraph) {
        const topicState = skillGraph.topics.get(topic.name.toLowerCase());
        if (topicState && topicState.mastery < 0.4) {
          score += 20; // Boost weak areas
        }

        // Check concepts
        topic.subtopics?.forEach((subtopicId: any) => {
          const subtopic = mongoose.model('Subtopic').findById(subtopicId);
          // Would check concept weakness
        });
      }

      // Time since last studied
      const topicState = skillGraph?.topics.get(topic.name.toLowerCase());
      if (topicState?.lastStudied) {
        const daysSinceLastStudy = Math.floor(
          (Date.now() - new Date(topicState.lastStudied).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastStudy > 3) {
          score += Math.min(daysSinceLastStudy, 10); // Bonus for not recent
        }
      }

      // Focus topics
      if (interviewProfile.preferences.focusTopics.some(
        ft => ft.toLowerCase() === topic.name.toLowerCase()
      )) {
        score += 10;
      }

      // Excluded topics
      if (interviewProfile.preferences.excludedTopics.some(
        et => et.toLowerCase() === topic.name.toLowerCase()
      )) {
        score -= 50; // Heavy penalty
      }

      return { topic, score };
    });

    // Sort by score and select top
    scoredTopics.sort((a, b) => b.score - a.score);
    return scoredTopics[0].topic;
  },

  // Select questions for a topic
  async selectQuestionsForTopic(
    userId: string,
    topic: any,
    difficultyDist: { EASY: number; MEDIUM: number; HARD: number; EXPERT: number },
    excludedTopics: string[],
    limit: number
  ): Promise<any[]> {
    const questions: any[] = [];
    const excludedHashes = new Set<string>();
    const excludedConcepts = new Set<string>();

    // Get user's question history to exclude already-seen questions
    const history = await QuestionHistoryModel.find({
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    for (const h of history) {
      excludedHashes.add(this.hashQuestion(h.questionSnapshot.question));
    }

    // Get questions from each difficulty level (skip levels with zero quota so
    // a user's difficulty choice is respected strictly)
    for (const [difficulty, count] of Object.entries(difficultyDist)) {
      if (!count) continue;

      const difficultyQuestions = await Question.find({
        topic: topic.name,
        difficulty,
        isHidden: false,
        isDeprecated: false,
        qualityStatus: 'approved',
      })
        .sort({ interviewPriority: -1, usageCount: 1 })
        .limit(count * 2) // Get more than needed to allow filtering
        .lean();

      for (const q of difficultyQuestions) {
        if (questions.length >= limit) break;

        // Check if question is in excluded topics
        if (excludedTopics.some(et =>
          q.topic.toLowerCase().includes(et.toLowerCase()) ||
          q.subtopic.toLowerCase().includes(et.toLowerCase())
        )) {
          continue;
        }

        // Check concept overlap
        const questionConcepts = q.concepts.map(c => c.toLowerCase());
        if (Array.from(excludedConcepts).some(ec =>
          questionConcepts.some(qc => qc.includes(ec))
        )) {
          continue;
        }

        questions.push(q);
        excludedConcepts.add(q.subtopic.toLowerCase());
      }
    }

    // If we don't have enough questions, generate some with AI
    if (questions.length < limit) {
      const needed = limit - questions.length;
      const generatedQuestions = await this.generateQuestionsWithAI(
        userId,
        topic.name,
        needed,
        difficultyDist
      );

      for (const q of generatedQuestions) {
        if (questions.length >= limit) break;
        questions.push(q);
      }
    }

    return questions.slice(0, limit);
  },

  /**
   * Generate questions with AI, seeded by the user's weak concepts and
   * already-seen questions (dedupe). Falls back to template questions when
   * no OpenAI-compatible key is configured or the call fails.
   */
  async generateQuestionsWithAI(
    userId: string,
    topic: string,
    count: number,
    difficultyDist: { EASY: number; MEDIUM: number; HARD: number; EXPERT: number }
  ): Promise<any[]> {
    const requestedDifficulty = this.getRequestedDifficulty(difficultyDist);

    // Weak concepts from the skill graph make generated questions relevant
    let weakConcepts: string[] = [];
    try {
      const sg = await SkillGraph.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
      weakConcepts = Object.entries((sg as any)?.concepts || {})
        .filter(([, state]: any) => state.weak || (state.mastery ?? 1) < 0.4)
        .sort((a: any, b: any) => (a[1].mastery ?? 0) - (b[1].mastery ?? 0))
        .slice(0, 5)
        .map(([name]) => name);
    } catch (sgErr) {
      logger.warn('Could not load weak concepts for AI generation', { error: (sgErr as Error).message });
    }

    // Already-seen questions (normalizedHash) for dedupe
    const seenHashes = new Set<string>();
    try {
      const history = await QuestionHistoryModel.find(
        { userId: new mongoose.Types.ObjectId(userId) },
        { 'questionSnapshot.question': 1 }
      )
        .limit(500)
        .lean();
      for (const h of history) {
        seenHashes.add(this.hashQuestion(h.questionSnapshot?.question || ''));
      }
    } catch {
      // dedupe is best-effort
    }

    const client = getOpenAIClient();
    if (client) {
      try {
        return await this.generateQuestionsWithAIProvider(
          client,
          topic,
          count,
          requestedDifficulty,
          weakConcepts,
          seenHashes
        );
      } catch (aiErr) {
        logger.warn('AI question generation failed, falling back to templates', {
          error: (aiErr as Error).message,
        });
      }
    }

    return this.generateTemplateQuestions(topic, count, requestedDifficulty);
  },

  /** LLM-backed generation with strict JSON schema and dedupe. */
  async generateQuestionsWithAIProvider(
    client: any,
    topic: string,
    count: number,
    requestedDifficulty: string | null,
    weakConcepts: string[],
    seenHashes: Set<string>
  ): Promise<any[]> {
    const systemPrompt =
      'You are a senior technical interviewer creating interview questions. ' +
      'Return ONLY JSON: {"questions": [{"question": string, "subtopic": string, "concepts": string[], ' +
      '"difficulty": "EASY"|"MEDIUM"|"HARD"|"EXPERT", "questionType": one of ["FOUNDATIONAL","CONCEPTUAL","INTERNAL_WORKING","IMPLEMENTATION","CODE_REASONING","DEBUGGING","PRODUCTION_SCENARIO","PERFORMANCE","CONCURRENCY","SECURITY","FAILURE_SCENARIO","DESIGN","TRADE_OFF","WHY","WHY_NOT","WHAT_HAPPENS_IF","MIGRATION","SCALABILITY","OBSERVABILITY","INCIDENT_RESPONSE","ARCHITECTURE"], ' +
      '"archetype": string, "detailedAnswer": string, "estimatedAnswerTimeSeconds": number}]}. ' +
      'Questions must be realistic interview questions with objectively gradable answers. ';

    const userPrompt = [
      `Generate ${count} interview question(s) on the topic: "${topic}".`,
      requestedDifficulty ? `Target difficulty: ${requestedDifficulty} only.` : 'Mix difficulties: one per difficulty level if possible.',
      weakConcepts.length
        ? `The candidate is weak in these concepts — probe them: ${weakConcepts.join(', ')}.`
        : '',
      'Make questions specific and non-generic; probe internals, trade-offs, and production scenarios.',
    ]
      .filter(Boolean)
      .join('\n');

    const completion = await client.chat.completions.create({
      model: config.ai.providers.openai.model,
      temperature: 0.8,
      max_tokens: 2500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const candidates: any[] = Array.isArray(parsed.questions) ? parsed.questions : [];

    const validTypes = new Set([
      'FOUNDATIONAL', 'CONCEPTUAL', 'INTERNAL_WORKING', 'IMPLEMENTATION', 'CODE_REASONING',
      'DEBUGGING', 'PRODUCTION_SCENARIO', 'PERFORMANCE', 'CONCURRENCY', 'SECURITY',
      'FAILURE_SCENARIO', 'DESIGN', 'TRADE_OFF', 'WHY', 'WHY_NOT', 'WHAT_HAPPENS_IF',
      'MIGRATION', 'SCALABILITY', 'OBSERVABILITY', 'INCIDENT_RESPONSE', 'ARCHITECTURE',
    ]);

    const seen = new Set<string>();
    const result: any[] = [];

    for (const c of candidates) {
      if (result.length >= count) break;
      if (!c || typeof c.question !== 'string' || c.question.trim().length < 10) continue;

      const difficulty = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'].includes(c.difficulty)
        ? c.difficulty
        : 'MEDIUM';
      const questionType = validTypes.has(c.questionType) ? c.questionType : 'CONCEPTUAL';

      // Dedupe: against the user's seen set AND within this batch
      const hash = this.hashQuestion(c.question.trim());
      if (seenHashes.has(hash) || seen.has(hash)) continue;
      seen.add(hash);

      result.push(
        new Question({
          question: c.question.trim(),
          topic,
          subtopic: String(c.subtopic || 'General').slice(0, 120),
          concepts: Array.isArray(c.concepts)
            ? c.concepts.map(String).map((s: string) => s.trim()).filter(Boolean).slice(0, 6)
            : [],
          difficulty,
          questionType,
          archetype: String(c.archetype || 'DEEP_DIVE').slice(0, 60),
          interviewPriority: 'HIGH',
          resumeRelevance: 'MEDIUM',
          expectedAnswerDepth: 'DEEP',
          estimatedAnswerTimeSeconds:
            typeof c.estimatedAnswerTimeSeconds === 'number' && c.estimatedAnswerTimeSeconds > 0
              ? Math.min(1200, Math.round(c.estimatedAnswerTimeSeconds))
              : 180,
          detailedAnswer: c.detailedAnswer ? String(c.detailedAnswer).slice(0, 5000) : undefined,
          followUpConcepts: [],
          tags: ['ai-generated'],
          provenance: 'AI_GENERATED',
          qualityStatus: 'approved',
          isHidden: false,
          isDeprecated: false,
          normalizedHash: hash,
          createdAt: new Date(),
          version: 1,
        })
      );
    }

    return result;
  },

  /**
   * Offline fallback: varied templates instead of the old fixed two, so
   * repeated fallbacks no longer produce identical questions.
   */
  generateTemplateQuestions(
    topic: string,
    count: number,
    requestedDifficulty: string | null
  ): any[] {
    const templates = [
      {
        question: `Walk through how ${topic} works internally, then explain what happens when it is pushed past its normal operating limits.`,
        subtopic: 'Internal Working',
        concepts: ['internals', 'limits'],
        difficulty: 'MEDIUM',
        questionType: 'INTERNAL_WORKING',
        archetype: 'DEEP_DIVE',
        estimatedAnswerTimeSeconds: 180,
      },
      {
        question: `A production system using ${topic} is degrading under load. How would you diagnose the bottleneck and what remediation options would you weigh?`,
        subtopic: 'Production Scenarios',
        concepts: ['production', 'diagnostics', 'performance'],
        difficulty: 'HARD',
        questionType: 'PRODUCTION_SCENARIO',
        archetype: 'SCALABILITY',
        estimatedAnswerTimeSeconds: 240,
      },
      {
        question: `What are the core trade-offs when choosing between ${topic} and its main alternatives? Describe a scenario where the usual choice would be wrong.`,
        subtopic: 'Trade-offs',
        concepts: ['trade-offs', 'architecture'],
        difficulty: 'MEDIUM',
        questionType: 'TRADE_OFF',
        archetype: 'TRADE_OFFS',
        estimatedAnswerTimeSeconds: 200,
      },
      {
        question: `Design a failure scenario for ${topic}: what breaks first, what are the cascading effects, and how would you make the system resilient?`,
        subtopic: 'Failure Scenarios',
        concepts: ['failure', 'reliability'],
        difficulty: 'HARD',
        questionType: 'FAILURE_SCENARIO',
        archetype: 'FAILURE_MODES',
        estimatedAnswerTimeSeconds: 240,
      },
      {
        question: `How would you explain ${topic} to a junior engineer, and what are the most common misconceptions you would correct?`,
        subtopic: 'Fundamentals',
        concepts: ['fundamentals', 'communication'],
        difficulty: 'EASY',
        questionType: 'FOUNDATIONAL',
        archetype: 'CLARITY',
        estimatedAnswerTimeSeconds: 120,
      },
      {
        question: `How does ${topic} behave differently at small scale versus at large scale, and what forces change the optimal approach?`,
        subtopic: 'Scalability',
        concepts: ['scalability', 'scale'],
        difficulty: 'EXPERT',
        questionType: 'SCALABILITY',
        archetype: 'SCALABILITY',
        estimatedAnswerTimeSeconds: 300,
      },
    ];

    return templates.slice(0, Math.max(0, count)).map((t, i) => {
      const questionText = count > templates.length
        ? `${t.question} (variant ${i + 1})`
        : t.question;

      return new Question({
        ...t,
        question: questionText,
        ...(requestedDifficulty ? { difficulty: requestedDifficulty } : {}),
        interviewPriority: 'HIGH',
        resumeRelevance: 'MEDIUM',
        expectedAnswerDepth: 'DEEP',
        followUpConcepts: [],
        tags: ['fallback'],
        provenance: 'AI_GENERATED',
        qualityStatus: 'approved',
        isHidden: false,
        isDeprecated: false,
        normalizedHash: this.hashQuestion(questionText),
        createdAt: new Date(),
        version: 1,
      });
    });
  },

  /**
   * When the distribution contains only one non-zero difficulty, that is the
   * user's explicit choice — used to tag fallback questions.
   */
  getRequestedDifficulty(
    difficultyDist: { EASY: number; MEDIUM: number; HARD: number; EXPERT: number }
  ): string | null {
    const nonZero = Object.entries(difficultyDist).filter(([, c]) => c > 0);
    return nonZero.length === 1 ? nonZero[0][0] : null;
  },

  // Hash question for uniqueness
  hashQuestion(question: string): string {
    let hash = 0;
    for (let i = 0; i < question.length; i++) {
      const char = question.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  },

  // Generate system design section
  async generateSystemDesignSection(
    sessionId: mongoose.Types.ObjectId,
    userId: string,
    interviewProfile: any,
    skillGraph: any,
    order: number
  ): Promise<any> {
    const userPreferences = interviewProfile.preferences;
    const count = userPreferences.systemDesignCount || 2;

    const sectionQuestions: any[] = [];

    // Get system design questions
    const systemDesignQuestions = await Question.find({
      isSystemDesign: true,
      isHidden: false,
      isDeprecated: false,
      qualityStatus: 'approved',
      difficulty: { $in: ['MEDIUM', 'HARD'] },
    })
      .sort({ interviewPriority: -1, usageCount: 1 })
      .limit(count * 2)
      .lean();

    // Filter out already-seen questions
    const userHistory = await QuestionHistoryModel.find({
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    const seenQuestionIds = new Set(userHistory.map(h => h.questionId.toString()));
    const availableQuestions = systemDesignQuestions.filter(q =>
      !seenQuestionIds.has(q._id.toString())
    );

    // Select questions
    const selectedQuestions = availableQuestions.slice(0, count);

    for (const question of selectedQuestions) {
      const sessionQuestion = await SessionQuestion.create({
        sessionId,
        questionId: question._id,
        sectionId: new mongoose.Types.ObjectId(),
        order: sectionQuestions.length,
        isRevision: false,
        status: 'pending',
        questionSnapshot: {
          question: question.question,
          topic: 'System Design',
          subtopic: question.subtopic || 'General',
          concepts: question.concepts,
          difficulty: question.difficulty,
          questionType: 'SYSTEM_DESIGN',
          archetype: 'DESIGN',
          interviewPriority: question.interviewPriority,
          estimatedAnswerTimeSeconds: 600,
          isSystemDesign: true,
          isCoding: false,
          isProjectInterview: false,
        },
      });

      sectionQuestions.push(sessionQuestion);
    }

    return {
      _id: new mongoose.Types.ObjectId(),
      type: 'system_design',
      title: 'System Design',
      description: `System design questions (${count} questions)`,
      order,
      status: 'pending',
      totalQuestions: sectionQuestions.length,
      completedQuestions: 0,
      questions: sectionQuestions.map(q => q._id),
      topic: 'System Design',
    };
  },

  // Generate coding section
  async generateCodingSection(
    sessionId: mongoose.Types.ObjectId,
    userId: string,
    interviewProfile: any,
    skillGraph: any,
    order: number
  ): Promise<any> {
    const userPreferences = interviewProfile.preferences;
    const count = userPreferences.codingCount || 2;

    const sectionQuestions: any[] = [];

    // Get coding problems
    const codingProblems = await mongoose.model('CodingProblem').find({
      isHidden: false,
      isDeprecated: false,
      isInterviewRelevant: true,
      difficulty: { $in: ['medium', 'hard'] },
    })
      .sort({ frequency: -1 })
      .limit(count * 3)
      .lean();

    // Filter based on user's patterns
    const userPatterns = userPreferences.codingFocus || ['arrays', 'strings', 'trees', 'graphs'];
    const filteredProblems = codingProblems.filter(p =>
      p.pattern?.some(pattern => userPatterns.includes(pattern))
    );

    // Get user's coding history
    const codingHistory = await mongoose.model('CodingHistory').find({
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    const seenProblemIds = new Set(codingHistory.map(h => h.problemId.toString()));
    const availableProblems = filteredProblems.filter(p =>
      !seenProblemIds.has((p as any)._id.toString())
    );

    const selectedProblems = availableProblems.slice(0, count);

    for (const problem of selectedProblems) {
      const sessionQuestion = await SessionQuestion.create({
        sessionId,
        questionId: problem._id,
        sectionId: new mongoose.Types.ObjectId(),
        order: sectionQuestions.length,
        isRevision: false,
        status: 'pending',
        questionSnapshot: {
          question: problem.title,
          topic: 'Coding',
          subtopic: problem.pattern?.join(', ') || 'General',
          concepts: problem.tags || [],
          difficulty: problem.difficulty.toUpperCase(),
          questionType: 'CODING',
          archetype: 'IMPLEMENTATION',
          interviewPriority: 'HIGH',
          estimatedAnswerTimeSeconds: 600,
          isSystemDesign: false,
          isCoding: true,
          isProjectInterview: false,
        },
        codingProblemData: problem,
      });

      sectionQuestions.push(sessionQuestion);
    }

    return {
      _id: new mongoose.Types.ObjectId(),
      type: 'coding',
      title: 'Coding Problems',
      description: `Coding problems (${count} problems)`,
      order,
      status: 'pending',
      totalQuestions: sectionQuestions.length,
      completedQuestions: 0,
      questions: sectionQuestions.map(q => q._id),
      topic: 'Coding',
    };
  },

  // Generate project interview section
  async generateProjectSection(
    sessionId: mongoose.Types.ObjectId,
    userId: string,
    interviewProfile: any,
    order: number
  ): Promise<any> {
    const userPreferences = interviewProfile.preferences;
    const count = userPreferences.projectQuestions || 5;

    // Get user's confirmed projects
    const projects = await mongoose.model('Project').find({
      userId: new mongoose.Types.ObjectId(userId),
      isHidden: false,
      status: 'active',
      isVerifiedFromResume: true,
    }).lean();

    if (projects.length === 0) {
      return {
        _id: new mongoose.Types.ObjectId(),
        type: 'project',
        title: 'Project Interview',
        description: 'No confirmed projects yet',
        order,
        status: 'pending',
        totalQuestions: 0,
        completedQuestions: 0,
        questions: [],
        topic: 'Project Interview',
      };
    }

    const sectionQuestions: any[] = [];
    const project = projects[0]; // Use first project

    // Generate project questions based on project interview tree
    const questionTemplates = [
      {
        question: `Tell me about ${project.name}. What problem were you trying to solve?`,
        topic: 'Project Interview',
        subtopic: `${project.name} - Motivation`,
        concepts: ['project', project.name.toLowerCase(), 'motivation'],
        difficulty: 'MEDIUM',
        questionType: 'RESUME_PROJECT',
        archetype: 'DEEP_DIVE',
        interviewPriority: 'VERY_HIGH',
        resumeRelevance: 'VERY_HIGH',
        expectedAnswerDepth: 'DEEP',
        estimatedAnswerTimeSeconds: 120,
        isProjectInterview: true,
        projectContext: {
          projectName: project.name,
          treeSection: 'motivation',
        },
      },
      {
        question: `What were the key architectural decisions you made for ${project.name} and why?`,
        topic: 'Project Interview',
        subtopic: `${project.name} - Architecture`,
        concepts: ['project', project.name.toLowerCase(), 'architecture', 'design decisions'],
        difficulty: 'HARD',
        questionType: 'RESUME_PROJECT',
        archetype: 'TRADE_OFF',
        interviewPriority: 'VERY_HIGH',
        resumeRelevance: 'VERY_HIGH',
        expectedAnswerDepth: 'DEEP',
        estimatedAnswerTimeSeconds: 180,
        isProjectInterview: true,
        projectContext: {
          projectName: project.name,
          treeSection: 'architecture',
        },
      },
      {
        question: `How did you handle data persistence in ${project.name}? Why did you choose that approach?`,
        topic: 'Project Interview',
        subtopic: `${project.name} - Database`,
        concepts: ['project', project.name.toLowerCase(), 'database', 'data modeling'],
        difficulty: 'HARD',
        questionType: 'RESUME_PROJECT',
        archetype: 'TRADE_OFF',
        interviewPriority: 'HIGH',
        resumeRelevance: 'VERY_HIGH',
        expectedAnswerDepth: 'DEEP',
        estimatedAnswerTimeSeconds: 180,
        isProjectInterview: true,
        projectContext: {
          projectName: project.name,
          treeSection: 'database',
        },
      },
      {
        question: `How would you scale ${project.name} if it needed to handle 10x more traffic?`,
        topic: 'Project Interview',
        subtopic: `${project.name} - Scalability`,
        concepts: ['project', project.name.toLowerCase(), 'scalability', 'scaling'],
        difficulty: 'HARD',
        questionType: 'RESUME_PROJECT',
        archetype: 'SCALABILITY',
        interviewPriority: 'HIGH',
        resumeRelevance: 'HIGH',
        expectedAnswerDepth: 'DEEP',
        estimatedAnswerTimeSeconds: 240,
        isProjectInterview: true,
        projectContext: {
          projectName: project.name,
          treeSection: 'scalability',
        },
      },
      {
        question: `What security considerations did you address in ${project.name}?`,
        topic: 'Project Interview',
        subtopic: `${project.name} - Security`,
        concepts: ['project', project.name.toLowerCase(), 'security'],
        difficulty: 'MEDIUM',
        questionType: 'RESUME_PROJECT',
        archetype: 'SECURITY',
        interviewPriority: 'HIGH',
        resumeRelevance: 'MEDIUM',
        expectedAnswerDepth: 'MODERATE',
        estimatedAnswerTimeSeconds: 120,
        isProjectInterview: true,
        projectContext: {
          projectName: project.name,
          treeSection: 'security',
        },
      },
    ];

    for (let i = 0; i < Math.min(count, questionTemplates.length); i++) {
      const template = questionTemplates[i];

      const sessionQuestion = await SessionQuestion.create({
        sessionId,
        questionId: new mongoose.Types.ObjectId(), // Will be linked to Question if created
        sectionId: new mongoose.Types.ObjectId(),
        order: sectionQuestions.length,
        isRevision: false,
        status: 'pending',
        questionSnapshot: {
          question: template.question,
          topic: template.topic,
          subtopic: template.subtopic,
          concepts: template.concepts,
          difficulty: template.difficulty,
          questionType: template.questionType,
          archetype: template.archetype,
          interviewPriority: template.interviewPriority,
          estimatedAnswerTimeSeconds: template.estimatedAnswerTimeSeconds,
          isSystemDesign: false,
          isCoding: false,
          isProjectInterview: true,
        },
        projectInterviewContext: template.projectContext,
      });

      sectionQuestions.push(sessionQuestion);
    }

    return {
      _id: new mongoose.Types.ObjectId(),
      type: 'project',
      title: `Project Interview - ${project.name}`,
      description: `${count} questions about ${project.name}`,
      order,
      status: 'pending',
      totalQuestions: sectionQuestions.length,
      completedQuestions: 0,
      questions: sectionQuestions.map(q => q._id),
      topic: 'Project Interview',
      projectName: project.name,
    };
  },

  // Get today's session
  async getTodaysSession(userId: string): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
        path: 'sections',
        populate: {
          path: 'questions',
          model: 'SessionQuestion',
        },
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
      questionId: new mongoose.Types.ObjectId(questionId),
    });

    if (!sessionQuestion) {
      throw new NotFoundError('Question not found in session');
    }

    // Record answer
    sessionQuestion.answer = answer;
    sessionQuestion.answerTimeSeconds = Math.floor(
      (Date.now() - new Date(sessionQuestion.createdAt).getTime()) / 1000
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
        questionSnapshot: sessionQuestion.questionSnapshot,
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

    session.status = 'completed';
    session.completedAt = new Date();
    session.totalTimeSeconds = Math.floor(
      (Date.now() - new Date(session.createdAt).getTime()) / 1000
    );
    await session.save();

    // Update user progress
    const UserProgress = mongoose.model('UserProgress');
    await (UserProgress as any).upsertForUser(new mongoose.Types.ObjectId(userId)).then(
      (up) => {
        up.totalQuestions += session.totalQuestions;
        up.answeredQuestions += session.totalQuestions;
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
