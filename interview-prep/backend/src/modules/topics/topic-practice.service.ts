import mongoose from 'mongoose';
import { z } from 'zod';
import logger from '../../config/logger';
import { Question } from '../questions/question.model';
import { QuestionHistory } from '../questions/question-history.model';
import { getOrCreateQuestionAnswer } from '../questions/answer.service';
import { recordQuestionInDailyCalendar, recomputeTotals } from '../calendar/calendar.service';
import DailyRecord from '../calendar/daily-record.model';
import { NotFoundError, ValidationError, ConflictError } from '../../common/filters/error-filter';
import { hasAI } from '../../common/services/ai-provider';
import { structuredAIMeta } from '../../common/services/structured-ai';
import { matchesQuestionTopic, nearDuplicate, questionHash } from '../questions/personalized-generator';
import ResumeProfile from '../resume/resume-profile.model';
import InterviewProfile from '../profile/interview-profile.model';
import { loadPracticeSource, PracticeSource, PracticeSourceRef, sourceEvidence } from './practice-source';

/**
 * Topic-wise practice service
 * ---------------------------
 * Free-form practice on any topic from the question bank. A practice set is
 * just a curated selection of bank questions; progress (answer / skip /
 * feedback) is tracked through QuestionHistory, and every interaction is
 * mirrored into the user's daily calendar record like session questions are.
 *
 * History and calendar stay shared per user (not per resume); each row is
 * still tagged with the resumeProfileId active when the question was served.
 */

function toClientQuestion(q: any) {
  return {
    id: String(q._id),
    question: q.question,
    topic: q.topic,
    subtopic: q.subtopic,
    concepts: q.concepts || [],
    difficulty: q.difficulty,
    questionType: q.questionType,
    archetype: q.archetype,
    estimatedTimeSeconds: q.estimatedAnswerTimeSeconds,
    isSystemDesign: !!q.isSystemDesign,
    isCoding: !!q.isCoding,
    isProjectInterview: !!q.isProjectInterview,
    codingProblem: q.isCoding
      ? {
          description: q.codingProblem?.description || '',
          constraints: q.codingProblem?.constraints || [],
          examples: q.codingProblem?.examples || [],
          starterCode: q.codingProblem?.starterCode || '',
          complexityTime: q.codingProblem?.complexityTime,
          complexitySpace: q.codingProblem?.complexitySpace,
        }
      : undefined,
  };
}

/** The active resume profile for the user, or null when none exists. */
export async function getActiveResumeProfileId(userId: string): Promise<mongoose.Types.ObjectId | null> {
  const ResumeProfile = mongoose.model('ResumeProfile');
  const profile: any = await ResumeProfile.findOne({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .select('_id')
    .lean();
  return profile ? profile._id : null;
}

/**
 * Bank visibility for one user.
 *
 * The id is cast to an ObjectId explicitly: inside an `$or`/`$and` sub-document
 * mongoose does not cast values against the schema, so a string userId matches
 * nothing in either `aggregate()` or `countDocuments()`. Curated bank rows have
 * no owner, so they are visible to everyone; owned rows are private.
 */
function bankVisibility(userId: string) {
  const ownerId = new mongoose.Types.ObjectId(userId);
  return {
    $or: [{ ownerUserId: { $exists: false }, provenance: 'CURATED' }, { ownerUserId: ownerId }],
  };
}

/** Distinct topics in the visible bank, with counts by difficulty and Coding split out. */
export async function listTopics(userId: string) {
  const visibility = bankVisibility(userId);
  const rows = await Question.aggregate([
    { $match: { isHidden: false, isDeprecated: false, qualityStatus: 'approved', isCoding: { $ne: true }, 'practiceSource.kind': { $exists: false }, ...visibility } },
    {
      $group: {
        _id: '$topic',
        total: { $sum: 1 },
        easy: { $sum: { $cond: [{ $eq: ['$difficulty', 'EASY'] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$difficulty', 'MEDIUM'] }, 1, 0] } },
        hard: { $sum: { $cond: [{ $eq: ['$difficulty', 'HARD'] }, 1, 0] } },
        expert: { $sum: { $cond: [{ $eq: ['$difficulty', 'EXPERT'] }, 1, 0] } },
        concepts: { $addToSet: '$concepts' },
      },
    },
    { $project: { total: 1, easy: 1, medium: 1, hard: 1, expert: 1, concepts: { $slice: [{ $reduce: { input: '$concepts', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } }, 8] } } },
    { $sort: { total: -1, _id: 1 } },
  ]);

  // Coding is its own practice topic regardless of which bank topic a coding
  // problem was filed under.
  const codingCount = await Question.countDocuments({
    isCoding: true,
    'practiceSource.kind': { $exists: false },
    isHidden: false,
    isDeprecated: false,
    qualityStatus: 'approved',
    ...visibility,
  });

  const topics = rows
    .filter((r: any) => r._id && String(r._id).toLowerCase() !== 'coding')
    .map((r: any) => ({
      topic: r._id,
      total: r.total,
      counts: { EASY: r.easy, MEDIUM: r.medium, HARD: r.hard, EXPERT: r.expert },
      concepts: r.concepts || [],
    }));

  if (codingCount > 0) {
    topics.unshift({ topic: 'Coding', total: codingCount, counts: { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 }, concepts: [] });
  }
  return topics;
}

/**
 * Skill/topic names offered in the Practice Topic Wise picker. Resume and
 * profile skills come first (in resume order), then every topic that already
 * exists in the user's bank, so previously practised topics stay reachable.
 * Free-form topics ("Other") are typed by the user at practice time and are
 * not listed here.
 */
export async function listPracticeSkills(userId: string): Promise<string[]> {
  const ownerId = new mongoose.Types.ObjectId(userId);
  const [resumeProfile, interviewProfile] = await Promise.all([
    ResumeProfile.findOne({ userId: ownerId }).sort({ updatedAt: -1 }).select('skills').lean(),
    InterviewProfile.findOne({ userId: ownerId }).select('confirmedSkills').lean(),
  ]);

  const names: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  };

  for (const skill of (resumeProfile as any)?.skills ?? []) {
    if (!skill?.isRemoved) push(skill?.name);
  }
  for (const skill of (interviewProfile as any)?.confirmedSkills ?? []) push(skill);
  for (const topic of await listTopics(userId)) push(topic.topic);
  return names;
}

export type PracticeDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

/**
 * Practice question-type ids. These deliberately reuse the app's existing
 * QuestionType taxonomy instead of inventing a parallel one: each practice id
 * maps onto the enum members it covers, and "coding" is the isCoding flag.
 */
export type PracticeQuestionType =
  | 'conceptual' | 'practical' | 'coding' | 'scenario' | 'troubleshooting' | 'system_design' | 'technical' | 'resume_deep_dive';

export const PRACTICE_QUESTION_TYPES: PracticeQuestionType[] = [
  'conceptual', 'practical', 'coding', 'scenario', 'troubleshooting', 'system_design', 'technical', 'resume_deep_dive',
];

export const PRACTICE_DIFFICULTIES: PracticeDifficulty[] = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];

export const PRACTICE_TYPE_TO_QUESTION_TYPES: Record<PracticeQuestionType, string[]> = {
  technical: ['INTERNAL_WORKING', 'IMPLEMENTATION', 'CODE_REASONING'],
  resume_deep_dive: ['WHY', 'TRADE_OFF', 'ARCHITECTURE'],
  conceptual: ['FOUNDATIONAL', 'CONCEPTUAL', 'INTERNAL_WORKING', 'WHY', 'WHY_NOT'],
  practical: ['IMPLEMENTATION', 'CODE_REASONING', 'PERFORMANCE', 'CONCURRENCY'],
  coding: ['CODING'],
  scenario: ['PRODUCTION_SCENARIO', 'FAILURE_SCENARIO', 'WHAT_HAPPENS_IF', 'MIGRATION'],
  troubleshooting: ['DEBUGGING', 'INCIDENT_RESPONSE', 'OBSERVABILITY'],
  system_design: ['SYSTEM_DESIGN', 'DESIGN', 'ARCHITECTURE', 'SCALABILITY', 'TRADE_OFF', 'SECURITY'],
};

/** Persisted questionType used when a practice type is requested. */
const PRACTICE_TYPE_TO_ENUM: Record<PracticeQuestionType, string> = {
  technical: 'INTERNAL_WORKING', resume_deep_dive: 'WHY',
  conceptual: 'CONCEPTUAL', practical: 'IMPLEMENTATION', coding: 'CODING',
  scenario: 'PRODUCTION_SCENARIO', troubleshooting: 'DEBUGGING', system_design: 'SYSTEM_DESIGN',
};

const PRACTICE_TYPE_LABEL: Record<PracticeQuestionType, string> = {
  technical: 'technical mechanisms of the actual supplied work',
  resume_deep_dive: 'resume deep dive: verify contributions, claims, alternatives and evidence',
  conceptual: 'conceptual (definitions, internals, why/why-not)',
  practical: 'practical implementation (how to build it, performance, concurrency)',
  coding: 'coding problems (a solvable problem with examples)',
  scenario: 'production scenario (what would you do, failure handling, migration)',
  troubleshooting: 'troubleshooting / debugging (diagnose and fix)',
  system_design: 'system and architecture design (trade-offs, scale, security)',
};

/** Legacy single-select aliases kept for older clients. */
export type TopicPracticeType = 'all' | 'easy' | 'medium' | 'hard' | 'expert' | 'practical';

const LEGACY_TYPE_TO_DIFFICULTY: Record<TopicPracticeType, PracticeDifficulty[]> = {
  all: [], easy: ['EASY'], medium: ['MEDIUM'], hard: ['HARD'], expert: ['EXPERT'],
  practical: ['MEDIUM', 'HARD', 'EXPERT'],
};

export type PracticeFilters = {
  difficulties?: PracticeDifficulty[];
  questionTypes?: PracticeQuestionType[];
};

/** Validate + normalize a practice selection; empty arrays mean "no filter". */
export function normalizePracticeFilters(input: {
  type?: TopicPracticeType;
  difficulties?: string[];
  questionTypes?: string[];
}): { difficulties: PracticeDifficulty[]; questionTypes: PracticeQuestionType[] } {
  const rawDifficulties = input.difficulties?.length
    ? input.difficulties
    : input.type
      ? LEGACY_TYPE_TO_DIFFICULTY[input.type] ?? []
      : [];
  for (const d of rawDifficulties) {
    if (!PRACTICE_DIFFICULTIES.includes(d as PracticeDifficulty)) {
      throw new ValidationError('Invalid difficulty selection');
    }
  }
  for (const t of input.questionTypes ?? []) {
    if (!PRACTICE_QUESTION_TYPES.includes(t as PracticeQuestionType)) {
      throw new ValidationError('Invalid question type selection');
    }
  }
  return {
    difficulties: [...new Set(rawDifficulties)] as PracticeDifficulty[],
    questionTypes: [...new Set(input.questionTypes ?? [])] as PracticeQuestionType[],
  };
}

/** Mongo filter for a topic practice selection, shared by every bank query. */
function buildQuestionFilter(params: {
  userId: string;
  topic: string;
  difficulties: PracticeDifficulty[];
  questionTypes: PracticeQuestionType[];
  excludeIds?: mongoose.Types.ObjectId[];
  source?: PracticeSource;
}): Record<string, any> {
  const isCodingTopic = params.topic.toLowerCase() === 'coding';
  const clauses: Record<string, any>[] = [bankVisibility(params.userId)];
  clauses.push(params.source
    ? { 'practiceSource.kind': params.source.kind, 'practiceSource.id': params.source.id }
    : { 'practiceSource.kind': { $exists: false } });
  if (params.excludeIds?.length) clauses.push({ _id: { $nin: params.excludeIds } });
  if (isCodingTopic) {
    // The Coding topic is always coding; other type selections do not apply.
    clauses.push({ isCoding: true });
  } else {
    clauses.push({ topic: params.topic });
    if (params.questionTypes.length) {
      const wantsCoding = params.questionTypes.includes('coding');
      const enumTypes = params.questionTypes
        .flatMap((t) => PRACTICE_TYPE_TO_QUESTION_TYPES[t])
        .filter((t) => t !== 'CODING');
      if (wantsCoding && enumTypes.length) {
        clauses.push({ $or: [{ isCoding: true }, { isCoding: { $ne: true }, questionType: { $in: enumTypes } }] });
      } else if (wantsCoding) {
        clauses.push({ isCoding: true });
      } else {
        clauses.push({ isCoding: { $ne: true } });
        if (enumTypes.length) clauses.push({ questionType: { $in: enumTypes } });
      }
    } else {
      clauses.push({ isCoding: { $ne: true } });
    }
  }
  if (params.difficulties.length) clauses.push({ difficulty: { $in: params.difficulties } });
  return { isHidden: false, isDeprecated: false, qualityStatus: 'approved', $and: clauses };
}

// ---------------------------------------------------------------------------
// On-demand topic-scoped generation
// ---------------------------------------------------------------------------

const topicQuestionSchema = z.object({
  evidence: z.array(z.string().min(1).max(2000)).max(5).optional(),
  question: z.string().min(40).max(2500),
  subtopic: z.string().min(1).max(150),
  concepts: z.array(z.string().min(1).max(100)).min(1).max(8),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']),
  archetype: z.enum(['FOUNDATIONAL', 'CONCEPTUAL', 'INTERNAL_WORKING', 'IMPLEMENTATION',
    'CODE_REASONING', 'DEBUGGING', 'PRODUCTION_SCENARIO', 'CONCURRENCY', 'SECURITY',
    'FAILURE_SCENARIO', 'TRADE_OFF', 'DESIGN', 'SCALABILITY', 'DEEP_DIVE']),
  detailedAnswer: z.string().min(350).max(6000),
  estimatedAnswerTimeSeconds: z.number().int().min(30).max(1800),
});
const topicBatchSchema = z.object({ questions: z.array(topicQuestionSchema).min(1).max(10) });

const codingTopicProblemSchema = z.object({
  question: z.string().min(20).max(400),
  description: z.string().min(120).max(3000),
  pattern: z.string().min(2).max(120),
  concepts: z.array(z.string().min(1).max(100)).min(1).max(8),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']),
  constraints: z.array(z.string().min(1).max(200)).min(1).max(8),
  examples: z.array(z.object({
    input: z.string().max(400), output: z.string().max(400),
    explanation: z.string().max(400).optional(),
  })).min(1).max(3),
  starterCode: z.string().max(2000).optional(),
  complexityTime: z.string().max(120),
  complexitySpace: z.string().max(120),
  detailedAnswer: z.string().min(350).max(6000),
  estimatedAnswerTimeSeconds: z.number().int().min(60).max(1800),
});
const codingTopicBatchSchema = z.object({ problems: z.array(codingTopicProblemSchema).min(1).max(6) });

/**
 * Generate topic-scoped questions with the AI provider when the curated bank
 * cannot cover the requested selection. Every question is screened to be
 * specifically about the topic (never a generic interview question), deduped,
 * and stored privately for this user. Failures are non-fatal: the caller still
 * returns whatever the bank produced, plus an explanatory message.
 */
export async function generateTopicQuestions(params: {
  userId: string;
  topic: string;
  difficulties: PracticeDifficulty[];
  questionTypes: PracticeQuestionType[];
  count: number;
  excludeTexts?: string[];
  source?: PracticeSource;
}): Promise<{ questions: any[]; message?: string }> {
  const { userId, topic, difficulties, questionTypes, count } = params;
  if (count <= 0) return { questions: [] };
  if (!hasAI()) {
    return {
      questions: [],
      message: 'The bank ran short for this selection. Set up an AI provider in Settings to generate fresh topic questions.',
    };
  }

  const isCodingTopic = !params.source && topic.toLowerCase() === 'coding';
  const wantsCoding = isCodingTopic || questionTypes.includes('coding');
  const excludeTexts = params.excludeTexts ?? [];
  const accepted: any[] = [];
  const rejections: Record<string, number> = {};
  const note = (reason: string) => { rejections[reason] = (rejections[reason] || 0) + 1; };
  const difficultyInstruction = difficulties.length === 1
    ? `Every question MUST have difficulty exactly ${difficulties[0]}. Never use any other difficulty.`
    : difficulties.length
      ? `Use only these difficulties: ${difficulties.join(', ')}.`
      : 'Choose an appropriate mix of difficulties (EASY, MEDIUM, HARD, EXPERT).';
  const typeInstruction = questionTypes.length
    ? `Question types to cover: ${questionTypes.map((t) => PRACTICE_TYPE_LABEL[t]).join('; ')}.`
    : 'Use a balanced mix of conceptual, practical, scenario and troubleshooting questions.';

  const textOf = (q: any) => `${q.question} ${q.detailedAnswer || ''} ${(q.concepts || []).join(' ')}`;

  // The provider sometimes returns fewer usable questions than asked, so keep
  // requesting the shortfall (bounded) until the requested count is reached.
  const maxAttempts = 3;
  try {
    for (let attempt = 0; attempt < maxAttempts && accepted.length < count; attempt++) {
      const asked = count - accepted.length;
      const attemptExcludeTexts = excludeTexts.concat(accepted.map((a) => a.question));
      const generated = isCodingTopic
        ? await generateCodingTopicBatch({ userId, topic, count: asked, difficultyInstruction, excludeTexts: attemptExcludeTexts })
        : await generateTextTopicBatch({
            userId, topic, count: asked, difficultyInstruction, typeInstruction,
            excludeTexts: attemptExcludeTexts, wantsCoding,
            source: params.source,
          });
      let added = 0;
      for (const q of generated) {
        if (accepted.length >= count) break;
        // Coding-topic questions are about code, so the topic-name screen does not
        // apply to them; everything else must mention the topic itself.
        if (params.source) {
          const facts = sourceEvidence(params.source.facts);
          const quotes = 'evidence' in q ? q.evidence || [] : [];
          if (!quotes.length || !quotes.every((quote: string) => facts.includes(quote)) ||
              !quotes.some((quote: string) => q.question.toLowerCase().includes(quote.toLowerCase()))) {
            note('unsupported_source_claim'); continue;
          }
        } else if (!isCodingTopic && !wantsCoding && !matchesQuestionTopic(topic, textOf(q))) { note('off_topic'); continue; }
        if (difficulties.length && !difficulties.includes(q.difficulty)) { note('difficulty_mismatch'); continue; }
        if ([...attemptExcludeTexts, ...accepted.map(a => a.question)].some((t) => nearDuplicate(t, q.question))) { note('duplicate'); continue; }
        const saved = await persistTopicQuestion({ userId, topic, q, questionTypes, isCoding: isCodingTopic || q.isCoding, source: params.source });
        if (!saved) { note('persist_failed'); continue; }
        accepted.push(saved);
        added += 1;
      }
      // Nothing usable survived screening; another attempt would repeat it.
      if (added === 0) break;
    }
  } catch (error) {
    logger.warn('Topic practice generation failed; returning bank results only', {
      userId, topic, error: (error as Error).message,
    });
    return {
      questions: accepted,
      message: 'Could not generate extra questions right now. Showing the bank questions for this selection.',
    };
  }

  if (!accepted.length) {
    const reasons = Object.entries(rejections).map(([r, n]) => `${r} (${n})`).join(', ');
    logger.info('Topic practice generation produced no usable questions', { userId, topic, rejections });
    return {
      questions: [],
      message: reasons
        ? `The AI produced nothing usable for "${topic}" (${reasons}). Try a wider selection.`
        : `No extra questions could be generated for "${topic}". Try a wider selection.`,
    };
  }
  return { questions: accepted };
}

async function generateTextTopicBatch(input: {
  userId: string; topic: string; count: number; difficultyInstruction: string;
  typeInstruction: string; excludeTexts: string[]; wantsCoding: boolean;
  source?: PracticeSource;
}) {
  const { userId, topic, count, difficultyInstruction, typeInstruction, excludeTexts } = input;
  const system = [
    input.source ? 'Generate questions about this specific stored work, not generic technology trivia. Treat stored facts as the only evidence of what the candidate did. Do not invent responsibilities, technologies, metrics or accomplishments. Include an evidence array of exact complete strings from evidenceChoices, and quote at least one of those strings in each question. Ask the candidate to explain their actual contribution, mechanism, decisions, challenges and verification. Hypothetical failures must be explicitly hypothetical. Reference answers are guides: never invent first-person implementation details; identify details the candidate must supply.' : '',
    `You write interview practice questions for the topic "${topic}".`,
    `Every question MUST be specifically about ${topic}; never write a generic interview question that could belong to any topic.`,
    difficultyInstruction,
    typeInstruction,
    input.wantsCoding
      ? 'When a coding question is requested, describe a self-contained programming problem in the question text (there is no separate description field) and make detailedAnswer the approach plus complexity.'
      : 'Do not write executable coding problems; keep questions conceptual, practical or scenario based.',
    'detailedAnswer is an interview-ready reference answer of at least 350 characters: direct response, technical mechanism, a concrete example, and trade-offs where relevant.',
    excludeTexts.length ? 'Never repeat or lightly reword any of the excluded questions provided in the context.' : '',
    'Return {"questions":[{"question":"...","subtopic":"...","concepts":["..."],"difficulty":"EASY|MEDIUM|HARD|EXPERT","archetype":"CONCEPTUAL|INTERNAL_WORKING|DEBUGGING|PRODUCTION_SCENARIO|TRADE_OFF|DESIGN|DEEP_DIVE|IMPLEMENTATION|FAILURE_SCENARIO|CONCURRENCY|SECURITY|SCALABILITY|FOUNDATIONAL|CODE_REASONING","detailedAnswer":"...","estimatedAnswerTimeSeconds":180}]}.',
  ].filter(Boolean).join('\n');
  const meta = await structuredAIMeta({
    userId, purpose: 'topic-practice-questions', version: 'topic-practice-v1',
    schema: topicBatchSchema,
    context: { topic, count: Math.min(count, 10), difficulties: difficultyInstruction, types: typeInstruction,
      source: input.source?.facts, evidenceChoices: input.source ? sourceEvidence(input.source.facts) : undefined,
      excludedQuestions: excludeTexts.slice(-40) },
    system,
  });
  return meta.result.questions.map((q) => ({ ...q, isCoding: false }));
}

async function generateCodingTopicBatch(input: {
  userId: string; topic: string; count: number; difficultyInstruction: string; excludeTexts: string[];
}) {
  const system = [
    'You write self-contained programming interview problems.',
    `The problems are practiced under the "${input.topic}" topic, so prefer that language or idiom when it is a programming language; otherwise use language-agnostic algorithms.`,
    input.difficultyInstruction,
    'Every problem must be solvable from the statement alone, with no external service, no company-specific trivia and no URLs.',
    'detailedAnswer explains the approach and the optimal solution in prose, at least 350 characters, including why it is correct.',
    input.excludeTexts.length ? 'Never repeat or lightly reword any of the excluded problems provided in the context.' : '',
    'Return {"problems":[{"question":"short title","description":"full problem statement with the task and expected output","pattern":"named pattern","concepts":["..."],"difficulty":"EASY|MEDIUM|HARD|EXPERT","constraints":["..."],"examples":[{"input":"...","output":"...","explanation":"..."}],"starterCode":"optional skeleton","complexityTime":"O(n)","complexitySpace":"O(1)","detailedAnswer":"...","estimatedAnswerTimeSeconds":900}]}.',
  ].filter(Boolean).join('\n');
  const meta = await structuredAIMeta({
    userId: input.userId, purpose: 'topic-practice-coding', version: 'topic-practice-coding-v1',
    schema: codingTopicBatchSchema,
    context: { topic: input.topic, count: input.count, difficulties: input.difficultyInstruction, excludedQuestions: input.excludeTexts.slice(-40) },
    system,
  });
  return meta.result.problems.map((p) => ({
    question: p.question, subtopic: p.pattern, concepts: p.concepts, difficulty: p.difficulty,
    archetype: 'IMPLEMENTATION', detailedAnswer: p.detailedAnswer,
    estimatedAnswerTimeSeconds: p.estimatedAnswerTimeSeconds, isCoding: true, codingProblem: p,
  }));
}

async function persistTopicQuestion(input: {
  userId: string; topic: string; q: any; questionTypes: PracticeQuestionType[]; isCoding: boolean;
  source?: PracticeSource;
}) {
  const { userId, topic, q, questionTypes, isCoding } = input;
  const mappedType = isCoding
    ? 'CODING'
    : PRACTICE_TYPE_TO_ENUM[questionTypes[0] ?? 'conceptual'] ?? 'CONCEPTUAL';
  const normalizedHash = input.source
    ? questionHash(`${userId}:${input.source.kind}:${input.source.id}:${q.question}`)
    : questionHash(q.question);
  try {
    return await Question.create({
      question: q.question,
      topic: isCoding ? 'Coding' : topic,
      subtopic: q.subtopic,
      concepts: q.concepts,
      difficulty: q.difficulty,
      questionType: mappedType,
      archetype: q.archetype,
      detailedAnswer: q.detailedAnswer,
      shortAnswer: String(q.detailedAnswer).slice(0, 400),
      estimatedAnswerTimeSeconds: q.estimatedAnswerTimeSeconds,
      isCoding,
      codingProblem: q.codingProblem
        ? {
            description: q.codingProblem.description, constraints: q.codingProblem.constraints,
            examples: q.codingProblem.examples, starterCode: q.codingProblem.starterCode,
            complexityTime: q.codingProblem.complexityTime, complexitySpace: q.codingProblem.complexitySpace,
            pattern: q.codingProblem.pattern,
          }
        : undefined,
      provenance: 'AI_GENERATED',
      qualityStatus: 'approved',
      qualityScore: 0.6,
      promptVersion: 'topic-practice-v1',
      generatedAt: new Date(),
      ownerUserId: new mongoose.Types.ObjectId(userId),
      normalizedHash,
      tags: ['topic-practice', 'ai-generated'],
      expectedAnswerDepth: 'DEEP',
      interviewPriority: 'HIGH',
      resumeRelevance: 'LOW',
      isTopicPractice: !input.source,
      isProjectInterview: input.source?.kind === 'project',
      practiceSource: input.source ? { kind: input.source.kind, id: input.source.id, label: input.source.label } : undefined,
      sourceContext: input.source?.facts,
      sourceEvidence: q.evidence,
    });
  } catch (e: any) {
    if (e.code !== 11000) throw e;
    // A global hash collision must never hand this user someone else's question.
    return Question.findOne({ normalizedHash, ownerUserId: new mongoose.Types.ObjectId(userId) });
  }
}

/**
 * Fetch (and mark presented in the calendar) the next batch of bank questions
 * for a topic. QuestionHistory rows are created eagerly so the practice flow
 * has durable per-question state with per-user uniqueness. When the bank runs
 * short and an AI provider is configured, the remainder is generated on demand
 * with strict topic screening.
 */
export async function startPracticeSet(params: {
  userId: string;
  topic: string;
  type?: TopicPracticeType;
  difficulties?: PracticeDifficulty[];
  questionTypes?: PracticeQuestionType[];
  count?: number;
  excludeQuestionIds?: string[];
  source?: PracticeSourceRef;
}): Promise<{ questions: any[]; generated: number; message?: string }> {
  const { userId, count: rawCount } = params;
  const source = params.source ? await loadPracticeSource(userId, params.source) : undefined;
  const topic = source ? source.label.slice(0, 120) : params.topic.trim();
  const count = Math.max(1, Math.min(rawCount ?? 10, 25));
  if (!topic || typeof topic !== 'string' || topic.trim().length > 120) {
    throw new ValidationError('A valid topic is required');
  }
  const { difficulties, questionTypes } = normalizePracticeFilters(params);
  if (source && questionTypes.includes('coding')) throw new ValidationError('Use technical or practical questions for work-specific practice');
  const isCodingTopic = !source && topic.toLowerCase() === 'coding';

  // Question ids the caller wants kept out of this set (e.g. Generate new question).
  const excludeIds = (params.excludeQuestionIds ?? [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  // Questions already seen by this user: any history row means it was served before.
  const historyRows = await QuestionHistory.find({ userId: new mongoose.Types.ObjectId(userId) })
    .select('questionId')
    .lean();
  const seenQuestionIds = new Set(historyRows.map((h: any) => String(h.questionId)));
  const seenIds = [...seenQuestionIds]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  let candidates = await Question.find(buildQuestionFilter({
    userId, topic, difficulties, questionTypes,
    source,
    excludeIds: [...excludeIds, ...seenIds],
  }))
    .sort({ interviewPriority: -1, usageCount: 1, createdAt: 1 })
    .limit(count * 3)
    .lean();

  // Top up with already-seen questions when the unseen bank ran dry, so the
  // user always gets practice material instead of an empty set.
  if (candidates.length < count) {
    const seenCandidates = await Question.find(
      buildQuestionFilter({ userId, topic, difficulties, questionTypes, excludeIds, source })
    )
      .sort({ interviewPriority: -1, usageCount: 1, createdAt: 1 })
      .limit(count * 3)
      .lean();
    const have = new Set(candidates.map((c: any) => String(c._id)));
    for (const q of seenCandidates) {
      if (candidates.length >= count) break;
      if (!have.has(String(q._id))) candidates.push(q);
    }
  }
  candidates = candidates.slice(0, count);

  // Bank exhausted? Generate the shortfall, strictly scoped to this topic.
  let generatedCount = 0;
  let message: string | undefined;
  if (candidates.length < count) {
    const recentlySeen = await Question.find({ _id: { $in: seenIds.slice(0, 60) } })
      .select('question')
      .lean();
    const excludeTexts = [...candidates, ...recentlySeen].map((q: any) => q.question);
    const result = await generateTopicQuestions({
      userId, topic, difficulties, questionTypes,
      count: count - candidates.length,
      source,
      excludeTexts,
    });
    generatedCount = result.questions.length;
    message = result.message;
    candidates = [...candidates, ...result.questions];
  }
  if (!candidates.length) {
    return { questions: [], generated: 0, message: message ?? `No questions are available for "${topic}" yet.` };
  }

  const resumeProfileId = source?.resumeProfileId || await getActiveResumeProfileId(userId);
  const occurredAt = new Date();
  const items: any[] = [];

  for (const q of candidates) {
    // Durable per-user state; a question practiced earlier in another topic
    // set keeps its original history row (unique per user+question).
    let history = await QuestionHistory.findOne({ userId: new mongoose.Types.ObjectId(userId), questionId: q._id });
    if (!history) {
      try {
        history = await QuestionHistory.create({
          userId: new mongoose.Types.ObjectId(userId),
          questionId: q._id,
          questionVersion: q.version || 1,
          resumeProfileId: resumeProfileId || undefined,
          isTopicPractice: !source,
          isCoding: !!q.isCoding,
          questionSnapshot: {
            question: q.question,
            topic: q.isCoding ? 'Coding' : q.topic,
            subtopic: q.subtopic,
            concepts: q.concepts || [],
            difficulty: q.difficulty,
            questionType: q.questionType,
            archetype: q.archetype,
            interviewPriority: q.interviewPriority,
            resumeRelevance: q.resumeRelevance,
            expectedAnswerDepth: q.expectedAnswerDepth || 'MODERATE',
            estimatedAnswerTimeSeconds: q.estimatedAnswerTimeSeconds,
            provenance: q.provenance,
            practiceSource: q.practiceSource,
          },
          status: 'NEW',
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          history = await QuestionHistory.findOne({ userId: new mongoose.Types.ObjectId(userId), questionId: q._id });
        } else {
          throw err;
        }
      }
    } else if (history.status === 'SKIPPED') {
      // Re-attempting a skipped question resets its practice state.
      history.status = 'NEW';
      await history.save();
    }

    // Present it in today's calendar entry list, idempotent by title.
    await recordQuestionInDailyCalendar(userId, {
      type: source?.kind === 'project' ? 'project' : isCodingTopic || q.isCoding ? 'coding' : 'technical',
      title: q.question,
      topic: isCodingTopic || q.isCoding ? 'Coding' : q.topic,
      subtopic: q.subtopic,
      concepts: q.concepts || [],
      difficulty: q.difficulty,
      status: 'presented',
      metadata: {
        questionId: String(q._id),
        source: source ? `${source.kind}-practice` : 'topic-practice',
        practiceSource: source ? { kind: source.kind, id: source.id, label: source.label } : undefined,
        practiceDifficulties: difficulties,
        practiceTypes: questionTypes,
      },
      occurredAt,
    });

    items.push({
      ...toClientQuestion(q),
      historyId: String(history!._id),
      status: history!.status,
      finalScore: history!.finalScore,
    });
  }

  logger.info('Topic practice set started', {
    userId, topic, difficulties, questionTypes,
    bank: items.length - generatedCount, generated: generatedCount,
  });
  return { questions: items, generated: generatedCount, message };
}

/** Load one practice question with its history state, enforcing ownership. */
async function loadPracticeQuestion(userId: string, questionId: string) {
  if (!mongoose.Types.ObjectId.isValid(questionId)) throw new ValidationError('Invalid question id');
  const question = await Question.findById(questionId);
  if (!question) throw new NotFoundError('Question not found');
  const visibilityOk =
    (!question.ownerUserId && question.provenance === 'CURATED') ||
    String(question.ownerUserId ?? '') === String(userId);
  if (!visibilityOk) throw new NotFoundError('Question not found');
  return question;
}

export async function getTopicQuestionAnswer(params: {
  userId: string;
  topic: string;
  questionId: string;
  regenerate?: boolean;
}) {
  const { userId, questionId, regenerate = false } = params;
  const question = await loadPracticeQuestion(userId, questionId);
  const answer = await getOrCreateQuestionAnswer({
    question,
    userId,
    regenerate,
    allowCache: !regenerate,
  });
  if (!regenerate) {
    await markPresented(userId, question);
  }
  return answer;
}

async function markPresented(userId: string, question: any) {
  try {
    const today = new Date();
    const { record } = await DailyRecord.findOrCreateForDate(new mongoose.Types.ObjectId(userId), today);
    const normalize = (t?: string) => (t || '').trim().toLowerCase();
    const title = question.question.trim();
    const existing = record.entries.find(
      (e: any) => e.type !== 'search' && normalize(e.title) === normalize(title)
    );
    if (existing) {
      existing.metadata = { ...(existing.metadata || {}), questionId: String(question._id) };
      if (existing.status === 'pending') existing.status = 'presented';
      recomputeTotals(record);
      await record.save();
    }
  } catch (err) {
    logger.warn('Failed to mark topic practice entry presented', {
      userId, error: (err as Error).message,
    });
  }
}

export async function skipTopicQuestion(params: { userId: string; questionId: string }) {
  const { userId, questionId } = params;
  const question = await loadPracticeQuestion(userId, questionId);
  const history = await QuestionHistory.findOne({ userId: new mongoose.Types.ObjectId(userId), questionId: question._id });
  if (!history) throw new NotFoundError('This question has not been served to you yet');

  if (history.status === 'ANSWERED') throw new ConflictError('Answered questions cannot be skipped');
  history.status = 'SKIPPED';
  await history.save();

  await markCalendarSkipped(userId, question);
  return { questionId: String(question._id), status: 'skipped' };
}

async function markCalendarSkipped(userId: string, question: any) {
  try {
    const today = new Date();
    const { record } = await DailyRecord.findOrCreateForDate(new mongoose.Types.ObjectId(userId), today);
    const normalize = (t?: string) => (t || '').trim().toLowerCase();
    const title = question.question.trim();
    const entry = record.entries.find(
      (e: any) => e.type !== 'search' && normalize(e.title) === normalize(title)
    );
    if (entry) {
      entry.status = 'skipped';
      recomputeTotals(record);
      await record.save();
    }
  } catch (err) {
    logger.warn('Failed to record skip in calendar', { userId, error: (err as Error).message });
  }
}

export type TopicFeedbackKind =
  | 'too_easy' | 'too_hard' | 'already_know' | 'not_relevant' | 'duplicate' | 'incorrect' | 'need_revision';

export async function recordTopicFeedback(params: {
  userId: string;
  questionId: string;
  kind: TopicFeedbackKind;
  notes?: string;
}) {
  const { userId, questionId, kind, notes = '' } = params;
  const question = await loadPracticeQuestion(userId, questionId);
  const history = await QuestionHistory.findOne({ userId: new mongoose.Types.ObjectId(userId), questionId: question._id });
  if (!history) throw new NotFoundError('This question has not been served to you yet');

  history.feedback = kind;
  history.feedbackNotes = notes;
  if (kind === 'already_know') history.difficultyFeedback = 'already_knew';
  else if (['too_easy', 'too_hard', 'not_relevant', 'duplicate', 'incorrect'].includes(kind))
    history.difficultyFeedback = kind as any;

  if (kind === 'too_hard' || kind === 'need_revision') {
    history.status = 'FLAG_FOR_REVIEW';
    history.flagged = true;
  }
  if (kind === 'already_know') {
    history.status = 'ANSWERED';
  }
  await history.save();

  logger.info('Topic practice feedback recorded', { userId, questionId, kind });
  return { questionId: String(question._id), feedback: kind };
}

/** Practice history for a topic (or the whole bank) pulled from QuestionHistory. */
export async function topicHistory(params: {
  userId: string;
  topic?: string;
  limit?: number;
  source?: PracticeSourceRef;
}) {
  const { userId, topic, limit: rawLimit } = params;
  const limit = Math.max(1, Math.min(rawLimit ?? 50, 200));
  const filter: Record<string, any> = { userId: new mongoose.Types.ObjectId(userId) };
  if (params.source) {
    const source = await loadPracticeSource(userId, params.source);
    const ids = await Question.find({ ownerUserId: userId, 'practiceSource.kind': source.kind,
      'practiceSource.id': source.id }).distinct('_id');
    filter.questionId = { $in: ids };
  }
  if (topic && topic.toLowerCase() !== 'all' && !params.source) {
    filter['questionSnapshot.practiceSource.kind'] = { $exists: false };
    if (topic.toLowerCase() === 'coding') filter.isCoding = true;
    else {
      filter.isCoding = { $ne: true };
      filter['questionSnapshot.topic'] = topic;
    }
  }

  const rows = await QuestionHistory.find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('questionId questionSnapshot isCoding status finalScore feedback difficultyFeedback answer updatedAt createdAt')
    .lean();

  return rows.map((h: any) => ({
    id: String(h._id),
    questionId: String(h.questionId),
    question: h.questionSnapshot?.question || '',
    topic: h.isCoding ? 'Coding' : h.questionSnapshot?.topic || '',
    subtopic: h.questionSnapshot?.subtopic || '',
    concepts: h.questionSnapshot?.concepts || [],
    difficulty: h.questionSnapshot?.difficulty || '',
    status: h.status,
    finalScore: h.finalScore,
    feedback: h.feedback,
    hasAnswer: Boolean(h.answer),
    updatedAt: h.updatedAt,
  }));
}

/** Brief per-topic progress counts for the topic picker cards. */
export async function topicProgressSummary(userId: string) {
  const rows = await QuestionHistory.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: { $cond: [{ $eq: ['$isCoding', true] }, 'Coding', '$questionSnapshot.topic'] },
        attempted: { $sum: 1 },
        answered: { $sum: { $cond: [{ $eq: ['$status', 'ANSWERED'] }, 1, 0] } },
        skipped: { $sum: { $cond: [{ $eq: ['$status', 'SKIPPED'] }, 1, 0] } },
        avgScore: { $avg: '$finalScore' },
      },
    },
    { $sort: { attempted: -1 } },
  ]);
  return rows.map((r: any) => ({
    topic: r._id || 'Unknown',
    attempted: r.attempted,
    answered: r.answered,
    skipped: r.skipped,
    averageScore: typeof r.avgScore === 'number' ? r.avgScore : undefined,
  }));
}
