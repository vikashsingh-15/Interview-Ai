import mongoose, { Schema } from 'mongoose';
import { createHash } from 'crypto';
import { z } from 'zod';
import OpenAI from 'openai';
import { aiProviderCandidates, hasFallbackAI } from '../../common/services/ai-provider';
import config from '../../config';
import logger from '../../config/logger';
import InterviewProfile from '../profile/interview-profile.model';
import ResumeProfile from '../resume/resume-profile.model';
import SkillGraph from '../skill-graph/skill-graph.model';
import { QuestionHistory } from './question-history.model';
import { Question } from './question.model';
import { structuredAIMeta } from '../../common/services/structured-ai';
import { BadRequestError, AIProviderError, RateLimitError, QuestionRejectedError, ApiError } from '../../common/filters/error-filter';

export const normalizeQuestion = (text: string) => text.normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
export const questionHash = (text: string) => createHash('sha256').update(normalizeQuestion(text)).digest('hex');
export function matchesQuestionTopic(topic: string, text: string): boolean {
  // This is the onboarding fallback category, not a phrase an answer must contain.
  if (normalizeQuestion(topic) === 'professional experience') return true;
  return (` ${normalizeQuestion(text)} `).includes(` ${normalizeQuestion(topic)} `);
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

export async function buildQuestionPlan(userId: string, topic: string, count: number, type = 'technical') {
  const profile = await InterviewProfile.findOne({ userId }).lean();
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
      responsibilities:p.responsibilities, claims:[...p.architectureClaims,...p.performanceClaims,...p.securityClaims],
    })),
  ].slice(0,60).map((fact,id)=>({ id, ...fact }));
  const weakConcepts = Object.entries((graph as any)?.concepts || {})
    .filter(([,v]:any)=>v.weak || v.questionCount > 0 && v.mastery < 0.4)
    .slice(0,10).map(([name])=>name);
  return {
    topic, count, type, targetRole:profile.targetRole, targetLevel:profile.targetLevel || profile.experienceLevel,
    actualExperienceMonths:profile.actualExperienceMonths, industries:profile.industries || [],
    targetCompanies:profile.targetCompanies, companyCalibration: false,
    difficulty:profile.preferences.difficulty, excludedTopics:profile.preferences.excludedTopics,
    focusTopics:profile.preferences.focusTopics, confirmedFacts:facts, weakConcepts,
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
  if (!model || !config.ai.apiKey) return undefined;
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
      } catch { /* try the next provider */ }
    }
  } catch { /* invalid provider configuration; skip semantic checks */ }
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
  const bank = await Question.find({ topic, qualityStatus:'approved', isHidden:false, isDeprecated:false,
    ...visibility }).limit(100).lean();
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
    if (type === 'project' && hasProjectFacts && !factIds.some((id:number)=>facts[id]?.kind === 'project'))
      reasons.push('no_confirmed_project');
    const relevantText = normalizeQuestion(q.question+' '+q.detailedAnswer+' '+q.concepts.join(' '));
    if (type !== 'project' && !matchesQuestionTopic(topic, relevantText) &&
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
    try { embedding = await questionEmbedding(q.question); } catch { /* lexical checks still protect exact repeats */ }
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

  try {
    if (accepted.length < count && config.ai.apiKey) {
      const generate = async (preferredProvider?: string) => structuredAIMeta({ userId,
        purpose:'personalized-questions', version:'question-v3', preferredProvider,
        schema:generatedBatchSchema, context:{ ...context, count:count-accepted.length,
          existingBankQuestions:bank.map(q=>q.question).slice(0,40) },
        system: `You are a role-agnostic personalized interviewer. The backend plan determines the topic and category.
Use ONLY confirmedFacts for statements about the candidate's actual experience; cite factIds. Never invent resume details.
General/hypothetical scenarios must be explicitly framed as hypothetical, not things the candidate did.
Generate different questions, not rewritten excluded questions. Concepts MAY repeat. Vary the scenario and reasoning task.
Respect difficulty, target level, interview category and excluded topics; no default Java/SDE-2 assumption.
No company provenance claims. No fabricated URLs. For project questions use a confirmed project and its actual claims.
Return {"questions":[{"question":"specific, answerable prompt","subtopic":"...","concepts":["..."],
"difficulty":"EASY|MEDIUM|HARD|EXPERT","archetype":"CONCEPTUAL|INTERNAL_WORKING|DEBUGGING|PRODUCTION_SCENARIO|TRADE_OFF|DESIGN|DEEP_DIVE",
"detailedAnswer":"an interview-ready answer of at least 350 characters: direct response, technical mechanism, concrete example, trade-offs, and when alternatives are appropriate","estimatedAnswerTimeSeconds":180,
"factIds":[0],"framing":"hypothetical|general_knowledge|confirmed_experience"}]}.
Do not generate executable coding problems here; coding uses a validated curated bank.`,
      });
      // A provider that answers but whose output fails validation is as useless
      // as one that errors, so every configured provider gets a turn before the
      // topic is called unavailable.
      let aiError:any;
      for (const provider of aiProviderCandidates().map(c=>c.name)) {
        if (accepted.length >= count) break;
        let meta;
        try { meta = await generate(provider); }
        catch (error) {
          // withAIFallback already walks every provider, so reaching here means
          // the whole chain is down; stop and report the provider failure.
          aiError = error;
          break;
        }
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
      }
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
