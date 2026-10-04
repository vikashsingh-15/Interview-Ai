'use client';

import { useState } from 'react';

/**
 * Shared, question-type-aware interview answer renderer.
 *
 * The backend returns the same structured shape for every question, but what an
 * interviewer expects differs by type: coding answers need approach, code and
 * explicit time/space complexity; conceptual answers need a direct answer,
 * explanation and example; scenario/troubleshooting answers need a recommended
 * approach with real-world considerations. This component picks the right
 * section labels and ordering per type while sharing one renderer everywhere
 * (Topics practice, Topics history, Calendar, Past questions).
 */

export interface StructuredAnswer {
  direct: string;
  questionFocus: string;
  why: string;
  how: string;
  example: string;
  tradeOff: string;
  summary: string;
}

export interface DetailedAnswer {
  overview: string;
  keyPoints: string[];
  algorithmOrApproach: string;
  complexity: string;
  codeSketch?: string;
  edgeCases: string[];
  commonMistakes: string[];
  whyItMatters: string;
  followUpQuestions: string[];
  summary: string;
}

export interface RevealedAnswer {
  sections?: StructuredAnswer;
  legacyAnswer?: string;
  detailed?: DetailedAnswer;
  description?: string;
  starterCode?: string;
  complexityTime?: string;
  complexitySpace?: string;
  solutionCode?: string;
}

export interface AnswerShapeHint {
  isCoding?: boolean;
  isSystemDesign?: boolean;
  difficulty?: string;
  questionType?: string;
}

type Block =
  | { kind: 'text'; label: string; body?: string }
  | { kind: 'list'; label: string; items?: string[] }
  | { kind: 'code'; label: string; body?: string };

const PRACTICAL_TYPES = ['IMPLEMENTATION', 'CODE_REASONING', 'PERFORMANCE', 'CONCURRENCY'];
const SCENARIO_TYPES = ['PRODUCTION_SCENARIO', 'WHAT_HAPPENS_IF', 'MIGRATION'];
const TROUBLESHOOT_TYPES = ['DEBUGGING', 'INCIDENT_RESPONSE', 'OBSERVABILITY', 'FAILURE_SCENARIO'];
const DESIGN_TYPES = ['SYSTEM_DESIGN', 'DESIGN', 'ARCHITECTURE', 'SCALABILITY'];

/** Human label for the answer structure, shown above the answer body. */
export function answerShapeLabel(hint: AnswerShapeHint): string {
  if (hint.isCoding) return 'Coding answer — approach, code, complexity and edge cases';
  const type = String(hint.questionType || '').toUpperCase();
  if (hint.isSystemDesign || DESIGN_TYPES.includes(type)) {
    return 'Design answer — architecture, trade-offs and scaling';
  }
  if (TROUBLESHOOT_TYPES.includes(type)) {
    return 'Troubleshooting answer — diagnosis, steps and pitfalls';
  }
  if (SCENARIO_TYPES.includes(type)) {
    return 'Scenario answer — approach, reasoning and real-world notes';
  }
  if (PRACTICAL_TYPES.includes(type)) {
    return 'Practical answer — approach, steps and considerations';
  }
  return 'Conceptual answer — direct answer, explanation and example';
}

/** Build the ordered answer blocks for a question shape. */
export function answerBlocks(answer: RevealedAnswer, hint: AnswerShapeHint): Block[] {
  const s = answer.sections;
  const d = answer.detailed;
  const blocks: Block[] = [];
  const type = String(hint.questionType || '').toUpperCase();

  if (!s) {
    if (answer.legacyAnswer) blocks.push({ kind: 'text', label: 'Answer', body: answer.legacyAnswer });
    return blocks;
  }

  if (hint.isCoding) {
    blocks.push({ kind: 'text', label: 'Direct answer', body: s.direct });
    blocks.push({ kind: 'text', label: 'Approach / algorithm', body: d?.algorithmOrApproach || s.how });
    blocks.push({ kind: 'code', label: 'Code', body: d?.codeSketch || answer.solutionCode || answer.starterCode });
    blocks.push({ kind: 'text', label: 'Time complexity', body: answer.complexityTime || d?.complexity });
    blocks.push({ kind: 'text', label: 'Space complexity', body: answer.complexitySpace });
    blocks.push({ kind: 'list', label: 'Edge cases', items: d?.edgeCases });
    blocks.push({ kind: 'list', label: 'Common mistakes', items: d?.commonMistakes });
    blocks.push({ kind: 'text', label: 'Interview points', body: s.questionFocus });
    blocks.push({ kind: 'text', label: 'Trade-off', body: s.tradeOff });
    blocks.push({ kind: 'text', label: 'Summary', body: s.summary });
    return blocks;
  }

  const isScenario = SCENARIO_TYPES.includes(type) || TROUBLESHOOT_TYPES.includes(type);
  const isDesign = !!hint.isSystemDesign || DESIGN_TYPES.includes(type);
  blocks.push({ kind: 'text', label: 'Direct answer', body: s.direct });
  blocks.push({ kind: 'text', label: isScenario ? 'Recommended approach' : 'Explanation', body: s.how });
  blocks.push({ kind: 'text', label: 'What the question asks', body: s.questionFocus });
  blocks.push({ kind: 'text', label: 'Why it matters', body: s.why });
  blocks.push({
    kind: 'text',
    label: isScenario ? 'Real-world considerations' : 'Concrete example',
    body: s.example,
  });
  blocks.push({ kind: 'list', label: 'Common mistakes', items: d?.commonMistakes });
  blocks.push({
    kind: 'list',
    label: isDesign ? 'Scaling / reliability considerations' : 'Edge cases',
    items: d?.edgeCases,
  });
  blocks.push({ kind: 'text', label: 'Trade-off', body: s.tradeOff });
  blocks.push({ kind: 'text', label: 'Summary', body: s.summary });
  return blocks;
}

/**
 * Render an interview answer. Falls back to the legacy plain-text answer when
 * the structured sections are unavailable (older cached questions).
 */
export function AnswerView({
  answer,
  hint = {},
  defaultDetailedOpen = false,
  className = '',
}: {
  answer: RevealedAnswer | null;
  hint?: AnswerShapeHint;
  defaultDetailedOpen?: boolean;
  className?: string;
}) {
  const [detailedOpen, setDetailedOpen] = useState(defaultDetailedOpen);

  if (!answer) {
    return <p className="text-xs text-brand-textSecondary">No answer available yet.</p>;
  }

  const blocks = answerBlocks(answer, hint);
  const d = answer.detailed;
  const isExpert = String(hint.difficulty || '').toUpperCase() === 'EXPERT';

  return (
    <div className={`space-y-3 ${className}`}>
      {answer.description && (
        <section className="rounded-lg border border-brand-border bg-brand-background p-4">
          <h4 className="text-sm font-semibold text-brand-primary">Problem</h4>
          <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{answer.description}</p>
        </section>
      )}

      <p className="text-[11px] uppercase tracking-wide text-brand-textSecondary">
        {answerShapeLabel(hint)}
      </p>

      {blocks.map((block, i) => {
        if (block.kind === 'code') {
          if (!block.body) return null;
          return (
            <section key={i} className="rounded-lg border border-brand-border bg-brand-background p-4">
              <h4 className="text-sm font-semibold text-brand-primary">{block.label}</h4>
              <pre className="mt-2 text-xs leading-6 text-brand-text whitespace-pre-wrap font-mono overflow-x-auto">
                {block.body}
              </pre>
            </section>
          );
        }
        if (block.kind === 'list') {
          if (!block.items?.length) return null;
          return (
            <section key={i} className="rounded-lg border border-brand-border bg-brand-background p-4">
              <h4 className="text-sm font-semibold text-brand-primary">{block.label}</h4>
              <ul className="mt-2 text-sm leading-7 text-brand-text space-y-1.5 list-disc list-inside">
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            </section>
          );
        }
        if (!block.body) return null;
        return (
          <section key={i} className="rounded-lg border border-brand-border bg-brand-background p-4">
            <h4 className="text-sm font-semibold text-brand-primary">{block.label}</h4>
            <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{block.body}</p>
          </section>
        );
      })}

      {d && (
        <div className="pt-2 border-t border-brand-border">
          <button
            type="button"
            onClick={() => setDetailedOpen((v) => !v)}
            className="text-xs font-medium text-brand-secondary hover:underline"
            aria-expanded={detailedOpen}
          >
            {detailedOpen ? 'Hide detailed study guide' : 'Show detailed study guide'}
          </button>
          {detailedOpen && (
            <div className="mt-3 space-y-3">
              {isExpert && d.whyItMatters && (
                <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h4 className="text-sm font-semibold text-brand-primary">Expert-level depth</h4>
                  <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{d.whyItMatters}</p>
                </section>
              )}
              <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                <h4 className="text-sm font-semibold text-brand-primary">Overview</h4>
                <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{d.overview}</p>
              </section>
              {d.keyPoints?.length > 0 && (
                <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                  <h4 className="text-sm font-semibold text-brand-primary">Key points</h4>
                  <ul className="mt-2 text-sm leading-7 text-brand-text space-y-1.5 list-disc list-inside">
                    {d.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </section>
              )}
              {d.algorithmOrApproach && !hint.isCoding && (
                <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                  <h4 className="text-sm font-semibold text-brand-primary">Algorithm / approach</h4>
                  <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{d.algorithmOrApproach}</p>
                </section>
              )}
              {d.complexity && !hint.isCoding && (
                <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                  <h4 className="text-sm font-semibold text-brand-primary">Complexity / trade-offs</h4>
                  <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{d.complexity}</p>
                </section>
              )}
              {!isExpert && d.whyItMatters && (
                <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                  <h4 className="text-sm font-semibold text-brand-primary">Why it matters</h4>
                  <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{d.whyItMatters}</p>
                </section>
              )}
              {d.followUpQuestions?.length > 0 && (
                <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                  <h4 className="text-sm font-semibold text-brand-primary">Likely follow-ups</h4>
                  <ul className="mt-2 text-sm leading-7 text-brand-text space-y-1.5 list-disc list-inside">
                    {d.followUpQuestions.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AnswerView;