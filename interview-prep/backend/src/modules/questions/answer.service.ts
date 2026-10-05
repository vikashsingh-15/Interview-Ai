import { z } from 'zod';
import { structuredAI } from '../../common/services/structured-ai';
import { hasAI } from '../../common/services/ai-provider';
import { Question } from './question.model';
import { NotFoundError } from '../../common/filters/error-filter';
import { resolveStoredResumeContext } from '../resume/resume-context.service';

// Short spoken-style interview answer (same shape as session answers).
const interviewAnswerSchema = z.object({
  direct: z.string().min(20).max(500),
  questionFocus: z.string().min(15).max(350),
  why: z.string().min(25).max(750),
  how: z.string().min(35).max(1000),
  example: z.string().min(35).max(850),
  tradeOff: z.string().min(25).max(750),
  summary: z.string().min(20).max(350),
});

// Rich study-guide answer, identical to the session detailed answer shape.
const interviewAnswerDetailedSchema = z.object({
  overview: z.string().min(40).max(1200),
  keyPoints: z.array(z.string().min(8).max(250)).min(3).max(10),
  algorithmOrApproach: z.string().min(40).max(1500),
  complexity: z.string().min(20).max(500),
  codeSketch: z.string().min(20).max(1500).optional(),
  edgeCases: z.array(z.string().min(8).max(250)).min(1).max(6),
  commonMistakes: z.array(z.string().min(8).max(250)).min(1).max(6),
  whyItMatters: z.string().min(30).max(700),
  followUpQuestions: z.array(z.string().min(10).max(250)).min(1).max(5),
  summary: z.string().min(20).max(400),
});

export type TopicPracticeAnswer = {
  sections?: z.infer<typeof interviewAnswerSchema>;
  legacyAnswer?: string;
  detailed?: z.infer<typeof interviewAnswerDetailedSchema>;
  description?: string;
  starterCode?: string;
  /** Coding questions carry their complexity and reference solution so the
   *  answer always shows time/space complexity even if the model omits them. */
  complexityTime?: string;
  complexitySpace?: string;
  solutionCode?: string;
};

export type AnswerQuestionInput = {
  question: any;
  userId: string;
  /** Force regeneration even when a cached answer exists. */
  regenerate?: boolean;
  /** When true, cached answers are returned without calling the AI provider. */
  allowCache?: boolean;
};

/**
 * Describe what the answer must cover for this specific question, so a
 * conceptual question, a coding problem, a production scenario and an expert
 * deep-dive each get the structure an interviewer expects instead of one
 * generic shape.
 */
function answerShapeFor(question: any): string {
  const type = String(question.questionType || '').toUpperCase();
  if (question.isCoding) {
    return [
      'This is a coding question. Cover the approach and the algorithm step by step,',
      'the concrete code or a faithful code sketch, the time complexity, the space complexity,',
      'and the edge cases that matter (empty input, single element, duplicates, overflow,',
      'bounds). State the complexities explicitly in the complexity field.',
    ].join(' ');
  }
  if (question.isSystemDesign || ['SYSTEM_DESIGN', 'DESIGN', 'ARCHITECTURE', 'SCALABILITY'].includes(type)) {
    return [
      'This is a system or design question. Give the recommended architecture, the step-by-step',
      'reasoning behind each component choice, the scaling and reliability considerations,',
      'the trade-offs and when an alternative design wins, and the failure modes.',
    ].join(' ');
  }
  if (['DEBUGGING', 'INCIDENT_RESPONSE', 'OBSERVABILITY', 'FAILURE_SCENARIO'].includes(type)) {
    return [
      'This is a troubleshooting question. Give the recommended diagnostic approach, a step-by-step',
      'reasoning path from symptom to root cause, the real-world considerations (logs, metrics,',
      'rollback, blast radius), and the common mistakes people make when debugging this.',
    ].join(' ');
  }
  if (['PRODUCTION_SCENARIO', 'WHAT_HAPPENS_IF', 'MIGRATION'].includes(type)) {
    return [
      'This is a practical production scenario. Give the recommended approach, the step-by-step',
      'reasoning, the real-world considerations (data safety, rollback, performance under load),',
      'and the common mistakes that cause incidents.',
    ].join(' ');
  }
  if (['IMPLEMENTATION', 'CODE_REASONING', 'PERFORMANCE', 'CONCURRENCY'].includes(type)) {
    return [
      'This is a practical implementation question. Give the recommended approach, the step-by-step',
      'reasoning, the real-world considerations (performance, concurrency, maintainability),',
      'and the common mistakes.',
    ].join(' ');
  }
  return [
    'This is a conceptual question. Give the direct answer first, then the explanation of the',
    'mechanism, then a concrete example, then the important interview points a strong candidate',
    'must mention.',
  ].join(' ');
}

/** Deeper reasoning is expected as difficulty rises. */
function depthInstructionFor(question: any): string {
  const grounding = question.sourceContext ? ' StoredWork is the only evidence of the candidate’s actual work. The reference is a study guide, not evidence of personal accomplishments. Explain mechanisms and trade-offs hypothetically when implementation details are absent, and ask the candidate to supply those details. Do not invent technologies, metrics, responsibilities or first-person claims.' : '';
  const difficulty = String(question.difficulty || 'MEDIUM').toUpperCase();
  if (difficulty === 'EXPERT') {
    return 'This is an EXPERT question: go beyond a textbook definition. Provide deeper technical reasoning, internal mechanisms, trade-offs and the limits of the approach, and say when an alternative is preferable.' + grounding;
  }
  if (difficulty === 'HARD') {
    return 'This is a HARD question: include the mechanisms and trade-offs an experienced engineer is expected to reason about, not just the definition.' + grounding;
  }
  if (difficulty === 'EASY') {
    return 'This is an EASY question: stay crisp and correct, and make the core idea unambiguous.' + grounding;
  }
  return 'Assume a mid-level interviewer is asking: be accurate, concrete and reasonably concise.' + grounding;
}

/**
 * Return a cached interview answer for a question, or generate one with the AI
 * provider and persist it on the question. Shared by the daily session and the
 * topic-wise practice flows so both surfaces show the same answer content.
 */
export async function getOrCreateQuestionAnswer(input: AnswerQuestionInput): Promise<TopicPracticeAnswer> {
  const { question, userId, regenerate = false, allowCache = true } = input;

  if (!question) throw new NotFoundError('Question not found');

  const storedResumeContext = await resolveStoredResumeContext(userId, question);
  const reference =
    question.interviewAnswer ||
    question.detailedAnswer ||
    question.shortAnswer ||
    question.codingProblem?.solutionCode ||
    '';

  // Coding questions always surface the problem statement and starter code
  // alongside the answer, so the answer is meaningful on its own.
  const codingExtras =
    question.isCoding && question.codingProblem
      ? {
          description: question.codingProblem.description,
          starterCode: question.codingProblem.starterCode,
          complexityTime: question.codingProblem.complexityTime,
          complexitySpace: question.codingProblem.complexitySpace,
          solutionCode: question.codingProblem.solutionCode,
        }
      : {};

  const cached = interviewAnswerSchema.safeParse(question.interviewAnswerSections);
  const hasCachedDetailed = question.interviewAnswerDetailed != null;

  if (!regenerate && allowCache && cached.success && hasCachedDetailed) {
    return { sections: cached.data, detailed: question.interviewAnswerDetailed, ...codingExtras };
  }

  if (!regenerate && allowCache && cached.success && !hasCachedDetailed) {
    if (!hasAI()) return { sections: cached.data, legacyAnswer: reference || undefined, ...codingExtras };
    // Short answer is cached but the detailed guide is missing: generate only the detailed part.
    const detailed = await generateDetailedOnly(userId, question, cached.data, reference);
    await Question.updateOne({ _id: question._id }, { $set: { interviewAnswerDetailed: detailed } });
    return { sections: cached.data, detailed, ...codingExtras };
  }

  if (!hasAI()) {
    if (reference) return { legacyAnswer: reference, ...codingExtras };
    throw new NotFoundError('An answer is not available for this question yet. Set up an AI provider in Settings to generate one.');
  }

  const shortSystemPrompt =
    'Write a technically accurate, standard interview answer to the exact question. The direct field MUST answer the question in its first sentence. questionFocus defines the key terms and what the interviewer is asking. why gives the rationale. how explains concrete steps or mechanism. example gives one specific hypothetical scenario. tradeOff names a real limitation and when an alternative fits. summary closes in one sentence. Keep the spoken answer (direct, why, how, example, tradeOff, summary) about 140-200 words total, suitable for 60-90 seconds. Use a real number only if the reference supplies one; do not fabricate metrics or personal experience. Correct technical mistakes in the reference. Do not claim that the candidate implemented a system unless verified. ' +
    answerShapeFor(question) + ' ' + depthInstructionFor(question) +
    ' Return a JSON object with string fields direct, questionFocus, why, how, example, tradeOff, summary.';

  const detailedSystemPrompt =
    'You are a senior technical interviewer preparing a candidate for a ' +
    (question.difficulty || 'intermediate') +
    ' ' +
    (question.questionType || 'technical') +
    ' interview question. Produce a complete, interview-ready detailed answer guide for the candidate to study. The answer must be technically accurate, specific, and suitable for a candidate targeting a Senior-level role. Do not claim the candidate implemented anything unless the reference says so. Cover the following in the fields below: - overview: a concise 2-4 sentence explanation of the core idea or approach. - keyPoints: 3-10 bullet-style statements capturing the essential concepts, mechanisms, or principles. - algorithmOrApproach: a step-by-step explanation of the algorithm, architecture, or reasoning approach. - complexity: time and space complexity (for coding), or key design trade-offs and scaling considerations (for system design). - codeSketch: for coding questions, a short pseudocode or language-agnostic sketch of the core approach (omit for non-coding). - edgeCases: 1-6 specific edge cases or pitfalls that a strong candidate should mention. - commonMistakes: 1-6 mistakes or weak answers that interviewers commonly see. - whyItMatters: why this question is asked and what it reveals about the candidate. - followUpQuestions: 1-5 likely follow-up questions the interviewer may ask. - summary: a one-sentence takeaway.' +
    answerShapeFor(question) + ' ' + depthInstructionFor(question) +
    ' Keep the full detailed answer focused and concrete; avoid filler and generic statements. Return a JSON object matching the schema exactly.';

  const [shortResult, detailedResult] = await Promise.all([
    structuredAI({
      userId,
      purpose: 'interview-answer',
      version: 'answer-v2',
      schema: interviewAnswerSchema,
      context: {
        question: question.question,
        reference,
        storedWork: question.sourceContext || storedResumeContext?.profile,
        concepts: question.concepts,
        difficulty: question.difficulty,
        type: question.questionType,
      },
      system: shortSystemPrompt,
    }),
    structuredAI({
      userId,
      purpose: 'interview-answer-detailed',
      version: 'answer-detailed-v1',
      schema: interviewAnswerDetailedSchema,
      context: {
        question: question.question,
        reference,
        concepts: question.concepts,
        difficulty: question.difficulty,
        type: question.questionType,
        shortAnswer: null,
        storedWork: question.sourceContext || storedResumeContext?.profile,
      },
      system: detailedSystemPrompt,
    }),
  ]);

  await Question.updateOne(
    { _id: question._id },
    { $set: { interviewAnswerSections: shortResult, interviewAnswerDetailed: detailedResult } }
  );

  return { sections: shortResult, detailed: detailedResult, ...codingExtras };
}

/** Generate only the detailed study guide from a cached short answer. */
async function generateDetailedOnly(userId: string, question: any, shortAnswer: any, reference: string) {
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
    answerShapeFor(question),
    depthInstructionFor(question),
    'Keep the full detailed answer focused and concrete; avoid filler and generic statements.',
    'Return a JSON object matching the schema exactly.',
  ].join(' ');

  return structuredAI({
    userId,
    purpose: 'interview-answer-detailed',
    version: 'answer-detailed-v1',
    schema: interviewAnswerDetailedSchema,
    context: {
      question: question.question,
      reference,
      concepts: question.concepts,
      difficulty: question.difficulty,
      type: question.questionType,
      shortAnswer,
      storedWork: question.sourceContext,
    },
    system: systemPrompt,
  });
}
