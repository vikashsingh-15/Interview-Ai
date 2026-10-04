'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Configuration step shown before a Practice Topic Wise session starts.
 *
 * The skill list is populated from the user's resume/profile skills plus every
 * topic already present in their question bank, with an "Other" escape hatch
 * for anything not on that list. Difficulty and question type reuse the app's
 * existing QuestionType taxonomy; "Mixed" means no filter for that group.
 */

export type PracticeDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

export type PracticeQuestionType =
  | 'conceptual' | 'practical' | 'coding' | 'scenario' | 'troubleshooting' | 'system_design' | 'technical' | 'resume_deep_dive';

export type PracticeQuestionTypeChoice = PracticeQuestionType | 'mixed';

export interface PracticeSelection {
  topic: string;
  difficulties: PracticeDifficulty[];
  questionTypes: PracticeQuestionType[];
  count: number;
}

export const DIFFICULTY_OPTIONS: { value: PracticeDifficulty; label: string }[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
  { value: 'EXPERT', label: 'Expert' },
];

export const QUESTION_TYPE_OPTIONS: {
  value: PracticeQuestionTypeChoice;
  label: string;
  hint: string;
}[] = [
  { value: 'conceptual', label: 'Conceptual', hint: 'Definitions, internals, why/why-not' },
  { value: 'technical', label: 'Technical', hint: 'Mechanisms and implementation details' },
  { value: 'resume_deep_dive', label: 'Resume Deep Dive', hint: 'Defend claims, contributions and decisions' },
  { value: 'practical', label: 'Practical', hint: 'How to build it, performance, concurrency' },
  { value: 'coding', label: 'Coding', hint: 'Solvable problems with examples' },
  { value: 'scenario', label: 'Scenario based', hint: 'Production situations and failure handling' },
  { value: 'troubleshooting', label: 'Troubleshooting', hint: 'Diagnose and fix' },
  { value: 'system_design', label: 'Design / Architecture', hint: 'Architecture, scale, trade-offs' },
  { value: 'mixed', label: 'Mixed', hint: 'A realistic blend of the types above' },
];

export const COUNT_OPTIONS = [5, 10, 15, 20];
export const MIN_COUNT = 1;
export const MAX_COUNT = 25; // matches the practice API limit
export const OTHER_SKILL = '__other__';

function radioClasses(checked: boolean): string {
  return `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
    checked
      ? 'border-brand-secondary bg-brand-secondary/10 text-brand-primary'
      : 'border-brand-border text-brand-textSecondary hover:border-brand-secondary/50'
  }`;
}

export function PracticeConfigDialog({
  skills,
  busy = false,
  error,
  onStart,
  onClose,
  fixedTopic,
}: {
  skills: string[];
  busy?: boolean;
  error?: string | null;
  onStart: (selection: PracticeSelection) => void;
  onClose: () => void;
  fixedTopic?: string;
}) {
  const [skill, setSkill] = useState<string>(skills[0] ?? OTHER_SKILL);
  const [otherTopic, setOtherTopic] = useState('');
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>('MEDIUM');
  const [questionType, setQuestionType] = useState<PracticeQuestionTypeChoice>('mixed');
  const [countChoice, setCountChoice] = useState<string>('10');
  const [customCount, setCustomCount] = useState('12');
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes the dialog, and focus moves into it on open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resolvedTopic = fixedTopic || (skill === OTHER_SKILL ? otherTopic.trim() : skill);
  const effectiveCount = countChoice === 'custom' ? Number(customCount) : Number(countChoice);
  const countValid =
    Number.isInteger(effectiveCount) && effectiveCount >= MIN_COUNT && effectiveCount <= MAX_COUNT;
  const topicValid = resolvedTopic.length >= 1 && resolvedTopic.length <= 120;
  const canStart = topicValid && countValid && !busy;

  const start = () => {
    if (!canStart) return;
    onStart({
      topic: resolvedTopic,
      difficulties: [difficulty],
      questionTypes: questionType === 'mixed' ? [] : [questionType],
      count: effectiveCount,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="practice-config-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-brand-border max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h2 id="practice-config-title" className="text-lg font-semibold text-brand-primary">
            {fixedTopic ? `Practice ${fixedTopic}` : 'Practice Topic Wise'}
          </h2>
          <p className="mt-1 text-sm text-brand-textSecondary">
            {fixedTopic ? 'Questions focus on your stored work and stay associated with this entry.' : 'Every question is filed under the topic you pick and appears in that topic’s question list.'}
          </p>

          {/* Skill */}
          {!fixedTopic && <div className="mt-5">
            <label htmlFor="practice-skill" className="text-sm font-medium text-brand-text">
              Select Skill
            </label>
            <select
              id="practice-skill"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-border bg-white p-2 text-sm text-brand-text"
            >
              {skills.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value={OTHER_SKILL}>Other</option>
            </select>
          </div>

          }
          {!fixedTopic && skill === OTHER_SKILL && (
            <div className="mt-3">
              <label htmlFor="practice-other-topic" className="text-sm font-medium text-brand-text">
                Enter topic/skill
              </label>
              <input
                id="practice-other-topic"
                type="text"
                value={otherTopic}
                onChange={(e) => setOtherTopic(e.target.value)}
                placeholder="Example: Kubernetes"
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-brand-border bg-white p-2 text-sm text-brand-text"
              />
            </div>
          )}

          {/* Difficulty */}
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-brand-text mb-2">Difficulty</legend>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_OPTIONS.map((o) => (
                <label key={o.value} className={radioClasses(difficulty === o.value)}>
                  <input
                    type="radio"
                    name="practice-difficulty"
                    className="accent-brand-secondary"
                    checked={difficulty === o.value}
                    onChange={() => setDifficulty(o.value)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Question type */}
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-brand-text mb-2">Question Type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUESTION_TYPE_OPTIONS.filter(o => !fixedTopic || o.value !== 'coding').map((o) => (
                <label key={o.value} className={`${radioClasses(questionType === o.value)} items-start`}>
                  <input
                    type="radio"
                    name="practice-question-type"
                    className="mt-0.5 accent-brand-secondary"
                    checked={questionType === o.value}
                    onChange={() => setQuestionType(o.value)}
                  />
                  <span>
                    <span className="block text-brand-text">{o.label}</span>
                    <span className="block text-xs text-brand-textSecondary">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Count */}
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-brand-text mb-2">Number of Questions</legend>
            <div className="flex flex-wrap items-center gap-2">
              {COUNT_OPTIONS.map((c) => (
                <label key={c} className={radioClasses(countChoice === String(c))}>
                  <input
                    type="radio"
                    name="practice-count"
                    className="accent-brand-secondary"
                    checked={countChoice === String(c)}
                    onChange={() => setCountChoice(String(c))}
                  />
                  {c}
                </label>
              ))}
              <label className={radioClasses(countChoice === 'custom')}>
                <input
                  type="radio"
                  name="practice-count"
                  className="accent-brand-secondary"
                  checked={countChoice === 'custom'}
                  onChange={() => setCountChoice('custom')}
                />
                Custom
              </label>
              {countChoice === 'custom' && (
                <input
                  type="number"
                  aria-label="Number of questions"
                  min={MIN_COUNT}
                  max={MAX_COUNT}
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  className="w-24 rounded-lg border border-brand-border bg-white p-2 text-sm text-brand-text"
                />
              )}
            </div>
            {!countValid && (
              <p className="mt-1.5 text-xs text-red-600">
                Choose between {MIN_COUNT} and {MAX_COUNT} questions.
              </p>
            )}
          </fieldset>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button isLoading={busy} disabled={!canStart} onClick={start}>
              Start Practice
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PracticeConfigDialog;
