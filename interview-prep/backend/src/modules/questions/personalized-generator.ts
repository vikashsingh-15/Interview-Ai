import mongoose, { Schema } from 'mongoose';
import { createHash } from 'crypto';
import { z } from 'zod';
import OpenAI from 'openai';
import { aiProviderCandidates, hasAnyAI, hasFallbackAI } from '../../common/services/ai-provider';
import config from '../../config';
import logger from '../../config/logger';
import InterviewProfile from '../profile/interview-profile.model';
import ResumeProfile from '../resume/resume-profile.model';
import SkillGraph from '../skill-graph/skill-graph.model';
import { QuestionHistory } from './question-history.model';
import { Question } from './question.model';
import { structuredAIMeta } from '../../common/services/structured-ai';
import Resume from '../resume/resume.model';
import { BadRequestError, AIProviderError, RateLimitError, QuestionRejectedError, ApiError } from '../../common/filters/error-filter';

export const normalizeQuestion = (text: string) => text.normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
export const questionHash = (text: string) => createHash('sha256').update(normalizeQuestion(text)).digest('hex');
export function matchesQuestionTopic(topic: string, text: string): boolean {
  // This is the onboarding fallback category, not a phrase an answer must contain.
  if (normalizeQuestion(topic) === 'professional experience') return true;
  return (` ${normalizeQuestion(text)} `).includes(` ${normalizeQuestion(topic)} `);
}
export function matchesSystemDesignTopic(topic: string, question: string, answer: string, concepts: string[], archetype: string): boolean {
  const text = normalizeQuestion([question, answer, ...(concepts || [])].join(' '));
  if (matchesQuestionTopic(topic, text)) return true;
  // Focus-area names (e.g. "Distributed systems") need not literally appear
  // in a well-scoped architecture prompt. Accept clear architecture vocabulary,
  // but do not let the design section take unrelated technical questions.
  return /\b(architect|architecture|design|distributed|scalab|availability|reliability|throughput|latency|consistency|partition|replication|shard|capacity|resilien|fault tolerance|service boundary|data model)\w*\b/.test(text) &&
    ['DESIGN', 'SCALABILITY', 'TRADE_OFF', 'DEEP_DIVE', 'FAILURE_SCENARIO'].includes(archetype);
}
export function hasValidProjectGrounding(topic: string, framing: string, factIds: number[], facts: any[]): boolean {
  const projects = facts.filter((fact:any)=>fact?.kind === 'project');
  if (!projects.length) return framing !== 'confirmed_experience' && factIds.length === 0;
  return factIds.some(id => {
    const fact = facts[id];
    return fact?.kind === 'project' && normalizeQuestion(fact.name || '') === normalizeQuestion(topic);
  });
}
export function buildProjectFallbackQuestions(topic: string, facts: any[], count: number, difficulty = 'mixed'): any[] {
  const allProjects = facts.filter((fact:any)=>fact?.kind === 'project');
  const project = allProjects.find((fact:any)=>normalizeQuestion(fact.name || '') === normalizeQuestion(topic));
  if (allProjects.length && !project) return [];
  const prompts = [
    ['Architecture', 'Walk through the main components and data flow, and distinguish your own confirmed contribution from the surrounding system.'],
    ['Decision trade-offs', 'Choose one important design decision, explain the alternatives, and state what evidence would justify the choice.'],
    ['Validation', 'Explain how you would verify the key behavior end to end, including meaningful tests, observability, and failure cases.'],
    ['Reliability', 'Identify a realistic failure mode, explain how you would detect it, and describe a safe recovery strategy.'],
    ['Security', 'Review the trust boundaries and sensitive data, then explain the controls and tests that would reduce the main risks.'],
    ['Performance', 'Describe how you would locate the dominant bottleneck, establish a baseline, and validate an optimization without guessing at metrics.'],
    ['Evolution', 'Explain how you would change or scale the design while preserving compatibility, data integrity, and a rollback path.'],
    ['Operations', 'Describe the signals and operational runbook you would need to diagnose an incident and restore service safely.'],
    ['Data lifecycle', 'Explain data retention, deletion, and migration requirements, including how you would keep derived data consistent.'],
    ['Capacity planning', 'Describe how you would estimate the workload, find the first scaling limit, and validate capacity before increasing traffic.'],
  ];
  const difficultyValue = ({easy:'EASY',medium:'MEDIUM',hard:'HARD',extra_hard:'EXPERT'} as any)[difficulty] || 'MEDIUM';
  const factId = project ? facts.indexOf(project) : -1;
  return prompts.slice(0, Math.max(0, count)).map(([subtopic, prompt]) => ({
    question: project
      ? `For your confirmed project "${topic}", ${prompt}`
      : `Imagine designing a hypothetical portfolio project around "${topic}". ${prompt}`,
    subtopic, concepts:['architecture','trade-offs','validation'], difficulty:difficultyValue,
    archetype:subtopic === 'Decision trade-offs' ? 'TRADE_OFF' : subtopic === 'Reliability' ? 'FAILURE_SCENARIO' : 'DEEP_DIVE',
    detailedAnswer: project
      ? `Use only details you can verify from the confirmed resume entry for ${topic}. Start with the specific components or decisions you personally owned, then explain the mechanism and why it was chosen. Separate measured evidence from estimates; do not invent performance numbers, incidents, security controls, or outcomes. Describe how you would validate the behavior, what alternatives and failure cases matter, and what you would improve with more time. If a detail is not in the record, state what you would need to confirm before making that claim.`
      : `Frame this strictly as a hypothetical design exercise, not as work you have already completed. Clarify the requirements and constraints first, propose a simple architecture, and explain data flow and component responsibilities. Compare at least one alternative, describe failure handling and security boundaries, and identify tests and operational signals. Make assumptions explicit and do not claim personal implementation experience, specific metrics, or completed outcomes.`,
    estimatedAnswerTimeSeconds:240, factIds:project ? [factId] : [],
    framing:project ? 'confirmed_experience' : 'hypothetical',
  }));
}
export function nearDuplicate(a: string, b: string): boolean {
  if (questionHash(a) === questionHash(b)) return true;
  const words = (s: string) => new Set(normalizeQuestion(s).split(' ').filter(w => w.length > 2));
  const x = words(a), y = words(b);
  if (!x.size || !y.size) return false;
  const common = [...x].filter(w => y.has(w)).length;
  return common / (x.size + y.size - common) >= 0.85;
}
export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  const dot = a.reduce((sum,v,i) => sum + v*b[i],0);
  const length = Math.sqrt(a.reduce((sum,v)=>sum+v*v,0)*b.reduce((sum,v)=>sum+v*v,0));
  return length ? dot/length : 0;
}
const exposureSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true }, questionId: { type: Schema.Types.ObjectId, required: true },
  normalizedHash: { type: String, required: true }, question: { type: String, required: true },
  topic: String, sessionId: Schema.Types.ObjectId, embedding: [Number], embeddingModel: String,
}, { timestamps: true });
exposureSchema.index({ userId: 1, normalizedHash: 1 }, { unique: true });
exposureSchema.index({ userId: 1, questionId: 1 }, { unique: true });
export const QuestionExposure = mongoose.model('QuestionExposure', exposureSchema);
export const QuestionGenerationPlan = mongoose.model('QuestionGenerationPlan', new Schema({
  userId: Schema.Types.ObjectId, sessionId: Schema.Types.ObjectId, topic: String,
  count: Number, type: String, reason: String, context: Schema.Types.Mixed, status: String,
}, { timestamps: true }));

const questionSchema = z.object({
  question: z.string().min(40).max(2500), subtopic: z.string().min(1).max(150),
  concepts: z.array(z.string().min(1).max(100)).min(1).max(8),
  difficulty: z.enum(['EASY','MEDIUM','HARD','EXPERT']),
  archetype: z.enum(['FOUNDATIONAL','CONCEPTUAL','INTERNAL_WORKING','IMPLEMENTATION','CODE_REASONING',
    'DEBUGGING','PRODUCTION_SCENARIO','CONCURRENCY','SECURITY','FAILURE_SCENARIO','TRADE_OFF','DESIGN','SCALABILITY','DEEP_DIVE']),
  detailedAnswer: z.string().min(350).max(6000),
  estimatedAnswerTimeSeconds: z.number().int().min(30).max(1800),
  factIds: z.array(z.number().int().min(0)).max(10).default([]),
  framing: z.enum(['hypothetical','general_knowledge','confirmed_experience']),
});
export const generatedBatchSchema = z.object({ questions: z.array(questionSchema).min(1).max(20) });

// Coding questions need a problem statement, not just a prompt. This is the
// fallback shape used when the curated CodingProblem bank cannot cover a
// section's quota, so a coding slot is never silently left empty.
const codingProblemSchema = z.object({
  question: z.string().min(20).max(400),
  description: z.string().min(120).max(3000),
  pattern: z.string().min(2).max(120),
  concepts: z.array(z.string().min(1).max(100)).min(1).max(8),
  difficulty: z.enum(['EASY','MEDIUM','HARD','EXPERT']),
  constraints: z.array(z.string().min(1).max(200)).min(1).max(8),
  examples: z.array(z.object({ input:z.string().max(400), output:z.string().max(400),
    explanation:z.string().max(400).optional() })).min(1).max(3),
  starterCode: z.string().max(2000).optional(),
  complexityTime: z.string().max(120),
  complexitySpace: z.string().max(120),
  detailedAnswer: z.string().min(350).max(6000),
  estimatedAnswerTimeSeconds: z.number().int().min(60).max(1800),
});
export const generatedCodingBatchSchema = z.object({ problems: z.array(codingProblemSchema).min(1).max(10) });

export async function buildQuestionPlan(userId: string, topic: string, count: number, type = 'technical') {
  const activeResume: any = await Resume.findOne({ userId, isActive: true, isDeleted: false }).select('currentVersionId').lean();
  const activeFacts: any = activeResume?.currentVersionId
    ? await ResumeProfile.findOne({ userId, resumeVersionId: activeResume.currentVersionId }).select('_id').lean()
    : null;
  const profile = activeFacts ? await InterviewProfile.findOne({ userId, resumeProfileId: activeFacts._id }).lean() : null;
  if (!profile?.onboardingCompleted) throw new BadRequestError('Complete resume review and onboarding first');
  const [resume, graph, history, exposure] = await Promise.all([
    ResumeProfile.findOne({ _id: profile.resumeProfileId, userId }).lean(),
    SkillGraph.findOne({ userId }).lean(),
    QuestionHistory.find({ userId }).sort({ updatedAt: -1 }).limit(30).lean(),
    QuestionExposure.find({ userId, topic }).sort({ createdAt: -1 }).limit(80).lean(),
  ]);
  const facts = [
    ...(resume?.skills || []).filter(s=>s.isConfirmed && !s.isRemoved).map(s=>({ kind:'skill', name:s.name })),
    ...(resume?.experience || []).filter(e=>e.isConfirmed && !e.isRemoved).map(e=>({
      kind:'experience', company:e.company, role:e.role, responsibilities:e.responsibilities,
      technologies:e.technologies, achievements:e.achievements, claims:e.technicalClaims,
    })),
    ...(resume?.projects || []).filter(p=>p.isConfirmed && !p.isRemoved).map(p=>({
      kind:'project', name:p.name, description:p.description, technologies:p.technologies,
      responsibilities:p.responsibilities, claims:[...(p.architectureClaims || []),...(p.performanceClaims || []),...(p.securityClaims || [])],
    })),
  ];
  // Project generation must not lose the relevant project claims behind a long
  // skills/experience list when the prompt context is capped.
  const orderedFacts = type === 'project'
    ? [...facts.filter(f=>f.kind === 'project'), ...facts.filter(f=>f.kind !== 'project')]
    : facts;
  const confirmedFacts = orderedFacts.slice(0,60).map((fact,id)=>({ id, ...fact }));
  const weakConcepts = Object.entries((graph as any)?.concepts || {})
    .filter(([,v]:any)=>v.weak || v.questionCount > 0 && v.mastery < 0.4)
    .slice(0,10).map(([name])=>name);
  return {
    topic, count, type, targetRole:profile.targetRole, targetLevel:profile.targetLevel || profile.experienceLevel,
    actualExperienceMonths:profile.actualExperienceMonths, industries:profile.industries || [],
    targetCompanies:profile.targetCompanies, companyCalibration: false,
    difficulty:profile.preferences.difficulty, excludedTopics:profile.preferences.excludedTopics,
    focusTopics:profile.preferences.focusTopics, confirmedFacts, weakConcepts,
    recentPerformance:history.map(h=>({ question:h.questionSnapshot.question, score:h.finalScore,
      feedback:h.feedback, difficultyFeedback:h.difficultyFeedback, status:h.status,
      gaps:h.conceptsWeak, answer:h.answer?.slice(0,500) })),
    excludedQuestions:exposure.map(e=>e.question),
    reason:weakConcepts.length ? 'Practice your confirmed background and measured weak concepts'
      : 'Practice your confirmed background and chosen interview preferences',
  };
}

export async function questionEmbedding(text: string): Promise<number[] | undefined> {
  const model = config.ai.embeddingModel;
  if (!model || !hasAnyAI()) return undefined;
  // Embeddings are best-effort: when the primary provider cannot serve, the
  // configured embedding model is tried on the fallback provider so dedup
  // quality survives a primary outage. Lexical checks always remain.
  try {
    for (const candidate of aiProviderCandidates()) {
      try {
        const client = new OpenAI({ apiKey:candidate.apiKey, baseURL:candidate.baseURL,
          timeout:config.ai.timeout, maxRetries:config.ai.retryCount });
        const result = await client.embeddings.create({ model, input: text });
        return result.data[0]?.embedding;
      } catch (err) {
        logger.debug('Question embedding fallback to next provider', {
          module: 'personalized', purpose: 'embedding',
          provider: candidate.name, error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logger.debug('Question embedding unavailable, using lexical dedup', {
      module: 'personalized', purpose: 'embedding',
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return undefined;
}

export async function generatePersonalizedQuestions(userId: string, topic: string, count: number, type = 'technical',
  sessionId?: mongoose.Types.ObjectId): Promise<any[]> {
  if (!count) return [];
  const context = await buildQuestionPlan(userId, topic, Math.min(count,20), type);
  if (context.excludedTopics.some(t=>topic.toLowerCase().includes(t.toLowerCase()))) return [];
  const plan = await QuestionGenerationPlan.create({ userId, sessionId, topic, count, type,
    reason:context.reason, context, status:'planning' });
  const allExposure = await QuestionExposure.find({ userId }).select('question normalizedHash embedding embeddingModel').lean();
  // Historical answers remain excluded even before the exposure backfill has been run.
  const legacy = await QuestionHistory.find({ userId }).select('questionSnapshot.question').lean();
  const seenTexts = [...allExposure.map(e=>e.question),...legacy.map(h=>h.questionSnapshot.question)];
  const seenHashes = new Set(seenTexts.map(questionHash));
  const visibility = { $or:[{ ownerUserId: { $exists:false }, provenance:'CURATED' },{ ownerUserId:userId }] };
  // System-design plans may split into named focus areas (HLD, distributed
  // systems), while the curated bank is grouped under the canonical topic.
  // Pull the tagged design bank rather than silently yielding an empty section.
  const bank = await Question.find({ ...(type === 'system_design' ? { isSystemDesign: true } : { topic }), qualityStatus:'approved', isHidden:false, isDeprecated:false,
    ...visibility }).lean();
  const available = bank.filter(q=>!seenHashes.has(questionHash(q.question)) &&
    !seenTexts.some(t=>nearDuplicate(t,q.question)) &&
    (context.difficulty === 'mixed' || q.difficulty === ({easy:'EASY',medium:'MEDIUM',hard:'HARD',extra_hard:'EXPERT'} as any)[context.difficulty]));
  const accepted:any[] = available.slice(0,count);
  // Why each candidate was refused. The provider usually answers fine, so this
  // breakdown is what makes an empty session explainable instead of mysterious.
  const rejections:Record<string, number> = {};
  const note = (reason:string) => { rejections[reason] = (rejections[reason] || 0) + 1; };
  const DIFFICULTY_MAP:any = { easy:'EASY', medium:'MEDIUM', hard:'HARD', extra_hard:'EXPERT' };
  // Hard checks protect correctness: never invent resume facts, never repeat a
  // question, never contradict an explicit exclusion. Soft checks are style and
  // relevance preferences that a usable batch can fail without being wrong.
  const SOFT_REASONS = ['off_topic','junior_level_wording','difficulty_mismatch'];

  /** Screen one generated question; returns its reasons, or [] when it passes. */
  const screen = (q:any): string[] => {
    const reasons:string[] = [];
    const facts = context.confirmedFacts as any[];
    // Out-of-range citations are dropped, not fatal: only a question that still
    // claims resume experience with no usable fact behind it is ungrounded.
    const factIds = (q.factIds || []).filter((id:number)=>Number.isInteger(id) && id>=0 && id<facts.length);
    if (q.framing === 'confirmed_experience' && !factIds.length) reasons.push('ungrounded_experience');
    // A project question must cite a confirmed project, but only when one exists.
    // With no confirmed project the question is reframed as a hypothetical
    // portfolio prompt on the section's topic rather than a resume claim, so the
    // user's chosen count is still honoured without inventing their history.
    const hasProjectFacts = facts.some((f:any)=>f?.kind === 'project');
    if (type === 'project' && !hasValidProjectGrounding(topic, q.framing, factIds, facts))
      reasons.push('no_confirmed_project');
    const relevantText = normalizeQuestion(q.question+' '+q.detailedAnswer+' '+q.concepts.join(' '));
    if (type === 'system_design' && !matchesSystemDesignTopic(topic, q.question, q.detailedAnswer, q.concepts, q.archetype))
      reasons.push('off_topic');
    if (type !== 'project' && type !== 'system_design' && !matchesQuestionTopic(topic, relevantText) &&
        !factIds.some((id:number)=>matchesQuestionTopic(topic, JSON.stringify(facts[id] || {}))))
      reasons.push('off_topic');
    if (/^(what is|define)\b/i.test(q.question.trim()) && !/entry|intern|graduate|junior/i.test(context.targetLevel || ''))
      reasons.push('junior_level_wording');
    if (context.difficulty !== 'mixed' && q.difficulty !== DIFFICULTY_MAP[context.difficulty])
      reasons.push('difficulty_mismatch');
    if (context.excludedTopics.some(t=>q.question.toLowerCase().includes(t.toLowerCase()))) reasons.push('excluded_topic');
    return reasons;
  };

  /** Persist an accepted question, honouring duplicate and grounding guarantees. */
  const persist = async (q:any, factIds:number[], servedModel:string, relaxed:boolean) => {
    if (accepted.length >= count) return;
    if (seenTexts.concat(accepted.map(a=>a.question)).some(t=>nearDuplicate(t,q.question))) { note('duplicate'); return; }
    // Semantic comparison is optional and explicit; exact/lexical exclusion always runs.
    let embedding:number[]|undefined;
    try { embedding = await questionEmbedding(q.question); } catch (err) { logger.debug('Question embedding skipped during dedup', { module: 'personalized', purpose: 'dedup', error: err instanceof Error ? err.message : String(err) }); }
    if (embedding && allExposure.some(e=>e.embeddingModel === config.ai.embeddingModel &&
        cosine(embedding!,e.embedding || []) >= 0.97)) { note('semantic_duplicate'); return; }
    const normalizedHash = questionHash(q.question);
    let saved;
    try {
      saved = await Question.create({ ...q, factIds:undefined, topic, ownerUserId:userId, normalizedHash, embedding,
        embeddingModel:embedding ? config.ai.embeddingModel : undefined,
        questionType:type === 'project' ? 'RESUME_PROJECT' : type === 'system_design' ? 'SYSTEM_DESIGN' : 'CONCEPTUAL',
        isProjectInterview:type === 'project', isSystemDesign:type === 'system_design',
        provenance:q.framing === 'confirmed_experience' ? 'RESUME_DERIVED' : 'AI_GENERATED',
        qualityStatus:'approved', qualityScore:relaxed ? 0.5 : 0.6, promptVersion:'question-v3',
        generatorModel:servedModel, generatedAt:new Date(),
        resumeClaimIds:factIds.map(String), sourceId:String(plan._id), tags:['personalized',q.framing],
        expectedAnswerDepth:'DEEP', interviewPriority:'HIGH', resumeRelevance:factIds.length ? 'HIGH' : 'LOW',
      });
    } catch(e:any) {
      if (e.code !== 11000) throw e;
      // Never reuse another user's private question after a global unique-hash collision.
      saved = await Question.findOne({ normalizedHash, ...visibility });
    }
    if (!saved) { note('persist_failed'); return; }
    if (relaxed) note('accepted_relaxed');
    accepted.push(saved);
  };
  const addLocalProjectGuides = async () => {
    if (type !== 'project' || accepted.length >= count) return;
    // Consider the full template set so previously exposed prompts do not
    // prevent unused prompts later in the list from filling this section.
    const guides = buildProjectFallbackQuestions(topic, context.confirmedFacts as any[], 10, context.difficulty);
    for (const guide of guides) {
      if (accepted.length >= count) break;
      const reasons = screen(guide).filter(r=>!SOFT_REASONS.includes(r));
      if (reasons.length) { reasons.forEach(note); continue; }
      await persist(guide, guide.factIds, 'local-project-guide-v1', true);
    }
  };

  try {
    if (accepted.length < count && hasAnyAI()) {
      const generate = async () => structuredAIMeta({ userId,
        purpose:'question_generation', version:'question-v4',
        schema:generatedBatchSchema, context:{ ...context, count:count-accepted.length,
          existingBankQuestions:bank.map(q=>q.question).slice(0,40) },
        system: `Generate ${count-accepted.length} distinct interview questions about the requested topic and category.
Ground confirmed experience only in confirmedFacts and cite factIds. Never invent resume or company claims.
Frame hypothetical scenarios as hypothetical. Respect difficulty, target level, excluded topics, and existing questions.
Each question needs a concise interview-ready detailedAnswer, useful subtopic/concepts, archetype, difficulty, estimatedAnswerTimeSeconds, factIds, and framing.
Return only {"questions":[{"question":"...","subtopic":"...","concepts":["..."],"difficulty":"EASY|MEDIUM|HARD|EXPERT","archetype":"CONCEPTUAL|INTERNAL_WORKING|DEBUGGING|PRODUCTION_SCENARIO|TRADE_OFF|DESIGN|DEEP_DIVE","detailedAnswer":"...","estimatedAnswerTimeSeconds":180,"factIds":[],"framing":"hypothetical|general_knowledge|confirmed_experience"}]}. Do not generate coding problems.`,
      });
      // A provider that answers but whose output fails validation is as useless
      // as one that errors, so every configured provider gets a turn before the
      // topic is called unavailable.
      let aiError:any;
      try {
        const meta = await generate();
        if (meta.provider !== config.ai.provider) {
          logger.info('Fallback AI provider served question generation', { topic,
            primary:`${config.ai.provider}/${config.ai.model}`, served:`${meta.provider}/${meta.model}` });
        }
        const screened = meta.result.questions.map(q=>({ q, reasons:screen(q) }));
        // Hard-passing questions first, then ones that missed only a style
        // preference, so a usable batch is never discarded wholesale.
        const ordered = [
          ...screened.filter(s=>!s.reasons.length),
          ...screened.filter(s=>s.reasons.length && s.reasons.every(r=>SOFT_REASONS.includes(r))),
          ...screened.filter(s=>s.reasons.some(r=>!SOFT_REASONS.includes(r))),
        ];
        const facts = context.confirmedFacts as any[];
        for (const { q, reasons } of ordered) {
          if (accepted.length >= count) break;
          const hard = reasons.filter(r=>!SOFT_REASONS.includes(r));
          if (hard.length) { hard.forEach(note); continue; }
          const soft = reasons.filter(r=>SOFT_REASONS.includes(r));
          soft.forEach(note);
          const factIds = (q.factIds||[]).filter((id:number)=>Number.isInteger(id) && id>=0 && id<facts.length);
          await persist(q, factIds, meta.model, soft.length>0);
        }
      } catch (error) { aiError = error; }
      if (!accepted.length) {
        if (aiError) throw aiError;
        const reasons = Object.entries(rejections).map(([reason,n])=>`${reason} (${n})`).join(', ');
        logger.warn('AI questions rejected by validation', { provider:config.ai.provider, model:config.ai.model,
          fallbackProvider:hasFallbackAI() ? config.ai.fallback.provider : undefined,
          fallbackModel:hasFallbackAI() ? config.ai.fallback.model : undefined,
          topic, planId:String(plan._id), rejections });
        // The provider answered; the batch simply did not clear our checks.
        // Blaming the provider here is what made this failure unexplainable.
        throw new QuestionRejectedError(
          `The AI provider answered, but none of its questions passed our checks for "${topic}" (${reasons || 'no usable output'}). Nothing was repeated or invented. Press Regenerate to try again, or widen the topic or set difficulty to Mixed in Settings.`, rejections);
      }
    }
    await addLocalProjectGuides();
    await QuestionGenerationPlan.updateOne({ _id:plan._id }, { status:accepted.length ? 'completed' : 'exhausted' });
  } catch(error) {
    await QuestionGenerationPlan.updateOne({ _id:plan._id }, { status:'failed' });
    const providerError = error as any;
    logger.error('Personalized question generation failed', {
      provider: config.ai.provider,
      model: config.ai.model,
      fallbackConfigured: hasFallbackAI(),
      fallbackProvider: hasFallbackAI() ? config.ai.fallback.provider : undefined,
      purpose: 'personalized-questions',
      error: providerError?.message || 'Unknown AI provider error',
      status: providerError?.status,
      code: providerError?.code,
      requestId: providerError?.request_id || providerError?.requestId,
    });
    if (type === 'project' && accepted.length < count) {
      await addLocalProjectGuides();
      if (accepted.length) await QuestionGenerationPlan.updateOne({ _id:plan._id }, {
        status:'completed', reason:`AI fallback with grounded project guides: ${accepted.length}/${count}` });
    }
    if (!accepted.length) {
      // Already-classified failures keep their own accurate message; only an
      // unclassified provider error is reported as provider unavailability.
      if (error instanceof ApiError) throw error;
      if (providerError?.status === 429 && /free-models-per-day/i.test(providerError?.message || '')) {
        throw new RateLimitError('OpenRouter free-model daily limit reached. Wait for the quota to reset or use another AI provider/model with available quota.');
      }
      if (providerError?.status === 429) {
        throw new RateLimitError('The AI provider rate limit was reached. Wait briefly, then try again.');
      }
      throw new AIProviderError('Question generation unavailable. Check the backend AI provider logs and configuration, then retry.', config.ai.provider, error as Error);
    }
  }
  // Never pad a shortage with repeats or masquerade templates as generated questions.
  return accepted;
}

/**
 * Generate coding questions with the AI when the curated CodingProblem bank
 * cannot cover the requested count. Without this a user who never ran the
 * coding seeder got a coding section with zero questions and no clear reason.
 */
export async function generateCodingQuestions(userId: string, topic: string, count: number,
  sessionId?: mongoose.Types.ObjectId): Promise<any[]> {
  if (!count) return [];
  const context = await buildQuestionPlan(userId, topic, count, 'coding');
  const plan = await QuestionGenerationPlan.create({ userId, sessionId, topic, count, type:'coding',
    reason:'Coding bank could not cover this section; generated with AI', context, status:'planning' });
  const allExposure = await QuestionExposure.find({ userId }).select('question normalizedHash').lean();
  const legacy = await QuestionHistory.find({ userId }).select('questionSnapshot.question').lean();
  const seenTexts = [...allExposure.map(e=>e.question),...legacy.map(h=>h.questionSnapshot.question)];
  const DIFFICULTY_MAP:any = { easy:'EASY', medium:'MEDIUM', hard:'HARD', extra_hard:'EXPERT' };
  const accepted:any[] = [];
  const rejections:Record<string, number> = {};
  const note = (reason:string) => { rejections[reason] = (rejections[reason] || 0) + 1; };
  try {
    let aiError:any;
    for (const provider of aiProviderCandidates().map(c=>c.name)) {
      if (accepted.length >= count) break;
      const meta = await structuredAIMeta({ userId, purpose:'personalized-coding', version:'coding-v1',
        preferredProvider:provider, schema:generatedCodingBatchSchema,
        context:{ ...context, count:count-accepted.length, excludedQuestions:seenTexts.slice(-40) },
        system: `You write self-contained programming interview problems for a ${context.targetLevel || 'software'} candidate.
Return problems that are solvable from the statement alone, with no external service, no company-specific trivia and no URLs.
Vary the pattern across the batch. Prefer ${topic} idioms or, when the language is unspecified, language-agnostic algorithms.
Never present the problem as something the candidate already built.
Return {"problems":[{"question":"short title","description":"full problem statement with the task and expected output",
"pattern":"named pattern e.g. sliding window","concepts":["..."],"difficulty":"EASY|MEDIUM|HARD|EXPERT",
"constraints":["..."],"examples":[{"input":"...","output":"...","explanation":"..."}],"starterCode":"optional skeleton",
"complexityTime":"O(n)","complexitySpace":"O(1)",
"detailedAnswer":"the approach and the optimal solution explained in prose, at least 350 characters, including why it is correct",
"estimatedAnswerTimeSeconds":900}]}.`,
      }).catch(error => { aiError = error; return null as any; });
      if (!meta) break;
      for (const problem of meta.result.problems) {
        if (accepted.length >= count) break;
        if (seenTexts.concat(accepted.map(a=>a.question)).some(t=>nearDuplicate(t, problem.question))) {
          note('duplicate'); continue;
        }
        if (context.difficulty !== 'mixed' && problem.difficulty !== DIFFICULTY_MAP[context.difficulty]) {
          note('difficulty_mismatch'); continue;
        }
        const normalizedHash = questionHash(problem.question);
        let saved;
        try {
          saved = await Question.create({ question:problem.question, topic, subtopic:problem.pattern,
            concepts:problem.concepts, difficulty:problem.difficulty, questionType:'CODING', archetype:'IMPLEMENTATION',
            detailedAnswer:problem.detailedAnswer, shortAnswer:problem.detailedAnswer.slice(0,400),
            estimatedAnswerTimeSeconds:problem.estimatedAnswerTimeSeconds, isCoding:true,
            codingProblem:{ description:problem.description, constraints:problem.constraints, examples:problem.examples,
              starterCode:problem.starterCode, complexityTime:problem.complexityTime,
              complexitySpace:problem.complexitySpace, pattern:problem.pattern },
            provenance:'AI_GENERATED', qualityStatus:'approved', qualityScore:0.6, promptVersion:'coding-v1',
            generatorModel:meta.model, generatedAt:new Date(), ownerUserId:userId, normalizedHash,
            sourceId:String(plan._id), tags:['coding','ai-generated'],
            expectedAnswerDepth:'DEEP', interviewPriority:'HIGH', resumeRelevance:'LOW' });
        } catch (e:any) {
          if (e.code !== 11000) throw e;
          saved = await Question.findOne({ normalizedHash, ownerUserId:userId });
        }
        if (!saved) { note('persist_failed'); continue; }
        accepted.push(saved);
      }
    }
    if (!accepted.length && aiError) throw aiError;
    if (!accepted.length) {
      logger.warn('AI coding fallback produced nothing', { userId, topic, rejections });
    }
    await QuestionGenerationPlan.updateOne({ _id:plan._id },
      { status:accepted.length ? 'completed' : 'exhausted', reason:`Coding fallback produced ${accepted.length}/${count}` });
  } catch (error) {
    await QuestionGenerationPlan.updateOne({ _id:plan._id }, { status:'failed' });
    logger.warn('AI coding fallback failed', { userId, topic, error:(error as Error).message });
    throw error;
  }
  return accepted;
}

export async function reserveQuestion(userId:string, sessionId:mongoose.Types.ObjectId, question:any):Promise<boolean> {
  try {
    await QuestionExposure.create({ userId, sessionId, questionId:question._id,
      question:question.question, topic:question.topic, normalizedHash:questionHash(question.question),
      embedding:question.embedding, embeddingModel:question.embeddingModel });
    return true;
  } catch(error:any) {
    if (error.code === 11000) return false;
    throw error;
  }
}

/** Question ids already exposed to the user across all sessions. */
export async function exposedQuestionIds(userId:string):Promise<Set<string>> {
  const rows = await QuestionExposure.find({ userId }).select('questionId').lean();
  return new Set(rows.map(r=>String(r.questionId)));
}
