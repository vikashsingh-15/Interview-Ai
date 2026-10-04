'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { AnswerView, RevealedAnswer } from '@/components/features/AnswerView';
import {
  PracticeConfigDialog,
  PracticeSelection,
} from '@/components/features/PracticeConfigDialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopicSummary {
  topic: string;
  total: number;
  counts: { EASY: number; MEDIUM: number; HARD: number; EXPERT: number };
  concepts: string[];
}

interface TopicProgress {
  topic: string;
  attempted: number;
  answered: number;
  skipped: number;
  averageScore?: number;
}

interface BankQuestion {
  _id: string;
  question: string;
  topic: string;
  subtopic: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  questionType: string;
  concepts: string[];
  estimatedAnswerTimeSeconds?: number;
  isCoding?: boolean;
  isTopicPractice?: boolean;
}

interface PracticeQuestion {
  id: string;
  question: string;
  topic: string;
  subtopic: string;
  concepts: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  questionType: string;
  archetype: string;
  estimatedTimeSeconds?: number;
  isSystemDesign: boolean;
  isCoding: boolean;
  isProjectInterview: boolean;
  codingProblem?: {
    description: string;
    constraints: string[];
    examples: Array<{ input: string; output: string; explanation?: string }>;
    starterCode: string;
    complexityTime?: string;
    complexitySpace?: string;
  };
  historyId: string;
  status: string;
  finalScore?: number;
}

interface PracticeState {
  topic: string;
  selection: PracticeSelection;
  questions: PracticeQuestion[];
  currentIndex: number;
  answers: Record<string, RevealedAnswer>;
}

interface HistoryRow {
  id: string;
  questionId: string;
  question: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  status: string;
  finalScore?: number;
  feedback?: string;
  hasAnswer: boolean;
  updatedAt: string;
}

const FEEDBACK_OPTIONS: { value: string; label: string }[] = [
  { value: 'too_easy', label: 'Too easy' },
  { value: 'too_hard', label: 'Too hard' },
  { value: 'already_know', label: 'Already know it' },
  { value: 'not_relevant', label: 'Not relevant' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'incorrect', label: 'Incorrect' },
  { value: 'need_revision', label: 'Need revision' },
];

const STORAGE_KEY = 'topic-practice-session-v1';
const DIFFICULTY_ORDER: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2, EXPERT: 3 };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PracticeScreen({ source }: { source?: { kind: 'project' | 'experience'; id: string; label: string } }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const storageKey = `${STORAGE_KEY}:${user?.id || 'anonymous'}:${source ? `${source.kind}:${source.id}` : 'topic'}`;
  const [topics, setTopics] = useState<TopicSummary[] | null>(null);
  const [progress, setProgress] = useState<TopicProgress[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  // Topic detail (every question filed under the topic, with its answer)
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [topicQuestions, setTopicQuestions] = useState<BankQuestion[] | null>(null);
  const [topicQuestionsFailed, setTopicQuestionsFailed] = useState(false);
  const [topicAnswers, setTopicAnswers] = useState<Record<string, RevealedAnswer>>({});
  const [topicAnswerLoading, setTopicAnswerLoading] = useState<string | null>(null);

  // Practice state
  const [configOpen, setConfigOpen] = useState(false);
  const [startingPractice, setStartingPractice] = useState(false);
  const [practice, setPractice] = useState<PracticeState | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [newQuestionLoading, setNewQuestionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resumable, setResumable] = useState<PracticeState | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAnswers, setHistoryAnswers] = useState<Record<string, RevealedAnswer>>({});
  const [historyAnswerLoading, setHistoryAnswerLoading] = useState<string | null>(null);

  const loadTopics = useCallback(() => {
    if (source) {
      return api.get(`/topics/source/${source.kind}/${source.id}`).then(res => {
        const qs: BankQuestion[] = res.data.data.questions || [];
        setTopics([{ topic: source.label.slice(0, 120), total: qs.length,
          counts: { EASY: qs.filter(q => q.difficulty === 'EASY').length, MEDIUM: qs.filter(q => q.difficulty === 'MEDIUM').length,
            HARD: qs.filter(q => q.difficulty === 'HARD').length, EXPERT: qs.filter(q => q.difficulty === 'EXPERT').length }, concepts: [] }]);
        setSkills([source.label.slice(0, 120)]);
      }).catch(() => setFailed(true));
    }
    return Promise.all([
      api.get('/topics'),
      api.get('/topics/progress').catch(() => ({ data: { data: [] } })),
      api.get('/topics/skills').catch(() => ({ data: { data: [] } })),
    ])
      .then(([topicsRes, progressRes, skillsRes]) => {
        setTopics(topicsRes.data.data ?? []);
        setProgress(progressRes.data.data ?? []);
        setSkills(skillsRes.data.data ?? []);
      })
      .catch(() => setFailed(true));
  }, [source]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadTopics();
  }, [authLoading, isAuthenticated, loadTopics]);

  // Offer to resume an unfinished practice session after a refresh.
  useEffect(() => {
    try {
      if (!user) return;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as PracticeState;
      if (saved?.topic && Array.isArray(saved.questions) && saved.questions.length) {
        setResumable(saved);
      }
    } catch {
      try { window.localStorage.removeItem(storageKey); } catch { /* unavailable storage */ }
    }
  }, [storageKey, user]);

  // Persist the in-progress session so navigation never loses it.
  useEffect(() => {
    if (!practice) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(practice));
    } catch {
      /* storage unavailable — the session still works in memory */
    }
  }, [practice, storageKey]);

  const current = practice ? practice.questions[practice.currentIndex] : undefined;
  const revealed = current && practice ? practice.answers[current.id] : undefined;
  const progressFor = (topic: string) => progress.find((p) => p.topic === topic);

  const refreshProgress = useCallback(() => {
    api
      .get('/topics/progress')
      .then((res) => setProgress(res.data.data ?? []))
      .catch(() => undefined);
  }, []);

  /** Open one topic: every question filed under it, existing and practice-made. */
  const openTopic = useCallback(async (topic: string) => {
    setActiveTopic(topic);
    setTopicQuestions(null);
    setTopicQuestionsFailed(false);
    setTopicAnswers({});
    setError(null);
    try {
      const res = source ? await api.get(`/topics/source/${source.kind}/${source.id}`)
        : await api.get('/questions', { params: { topic, limit: 100 } });
      const rows: BankQuestion[] = source ? res.data.data.questions : res.data.data ?? [];
      rows.sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 9) - (DIFFICULTY_ORDER[b.difficulty] ?? 9));
      setTopicQuestions(rows);
    } catch {
      setTopicQuestionsFailed(true);
    }
  }, [source]);

  const revealTopicAnswer = useCallback(
    async (questionId: string, regenerate: boolean) => {
      if (topicAnswerLoading) return;
      setTopicAnswerLoading(questionId);
      setError(null);
      try {
        const res = regenerate
          ? await api.post(`/sessions/question/${questionId}/generate-answer`)
          : await api.get(`/sessions/question/${questionId}/answer`);
        setTopicAnswers((prev) => ({ ...prev, [questionId]: res.data.data }));
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || 'Could not load the answer. Try again.');
      } finally {
        setTopicAnswerLoading(null);
      }
    },
    [topicAnswerLoading]
  );

  const loadHistory = useCallback(async (topic: string) => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/topics/history', { params: { topic, sourceKind: source?.kind, sourceId: source?.id } });
      setHistory(res.data.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [source]);

  const startPractice = useCallback(async (selection: PracticeSelection) => {
    const topic = selection.topic;
    setStartingPractice(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post('/topics/practice', {
        topic,
        source: source ? { kind: source.kind, id: source.id } : undefined,
        difficulties: selection.difficulties,
        questionTypes: selection.questionTypes,
        count: selection.count,
      });
      const qs: PracticeQuestion[] = res.data.data?.questions ?? [];
      const message: string | undefined = res.data.data?.message;
      if (!qs.length) {
        setError(message || `No questions are available for "${topic}" with that selection yet. Try a wider selection.`);
        return;
      }
      setConfigOpen(false);
      setResumable(null);
      setActiveTopic(null);
      setPractice({ topic, selection, questions: qs, currentIndex: 0, answers: {} });
      setNotice(message ?? null);
      // Practice questions are filed under the topic immediately, so refresh
      // the topic list and counts for when the user returns to it.
      void loadTopics();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not start practice. Try again.');
    } finally {
      setStartingPractice(false);
    }
  }, [loadTopics, source]);

  const revealAnswer = useCallback(
    async (regenerate = false) => {
      if (!practice || !current || answerLoading) return;
      setAnswerLoading(true);
      setError(null);
      try {
        const res = regenerate
          ? await api.post(`/topics/questions/${current.id}/generate-answer`, { topic: practice.topic })
          : await api.get(`/topics/questions/${current.id}/answer`, { params: { topic: practice.topic } });
        setPractice((prev) =>
          prev ? { ...prev, answers: { ...prev.answers, [current.id]: res.data.data } } : prev
        );
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || 'Could not load the answer. Try again.');
      } finally {
        setAnswerLoading(false);
      }
    },
    [practice, current, answerLoading]
  );

  const goTo = useCallback((index: number) => {
    setPractice((prev) =>
      prev
        ? { ...prev, currentIndex: Math.max(0, Math.min(index, prev.questions.length - 1)) }
        : prev
    );
  }, []);

  const skipQuestion = useCallback(async () => {
    if (!practice || !current || skipLoading) return;
    setSkipLoading(true);
    setError(null);
    try {
      await api.post(`/topics/questions/${current.id}/skip`, { topic: practice.topic });
      setPractice((prev) => {
        if (!prev) return prev;
        const questions = prev.questions.map((q) =>
          q.id === current.id ? { ...q, status: 'SKIPPED' } : q
        );
        const nextIndex = Math.min(prev.currentIndex + 1, questions.length - 1);
        return { ...prev, questions, currentIndex: nextIndex };
      });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not skip this question. Try again.');
    } finally {
      setSkipLoading(false);
    }
  }, [practice, current, skipLoading]);

  const sendFeedback = useCallback(
    async (kind: string) => {
      if (!practice || !current || feedbackBusy) return;
      setFeedbackBusy(true);
      setError(null);
      try {
        await api.post(`/topics/questions/${current.id}/feedback`, { kind });
        setNotice('Feedback saved.');
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || 'Could not save feedback. Try again.');
      } finally {
        setFeedbackBusy(false);
      }
    },
    [practice, current, feedbackBusy]
  );

  /** Append one more question to the running session without losing state. */
  const generateNewQuestion = useCallback(async () => {
    if (!practice || newQuestionLoading) return;
    setNewQuestionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post('/topics/practice', {
        topic: practice.topic,
        source: source ? { kind: source.kind, id: source.id } : undefined,
        difficulties: practice.selection.difficulties,
        questionTypes: practice.selection.questionTypes,
        count: 1,
        excludeQuestionIds: practice.questions.map((q) => q.id),
      });
      const qs: PracticeQuestion[] = res.data.data?.questions ?? [];
      const message: string | undefined = res.data.data?.message;
      if (!qs.length) {
        setNotice(message || 'No further questions are available for this selection.');
        return;
      }
      setPractice((prev) => (prev ? { ...prev, questions: [...prev.questions, ...qs] } : prev));
      setNotice(message ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not generate another question. Try again.');
    } finally {
      setNewQuestionLoading(false);
    }
  }, [practice, newQuestionLoading, source]);

  const endPractice = useCallback(() => {
    setPractice(null);
    setResumable(null);
    setError(null);
    setNotice(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore storage errors */
    }
    refreshProgress();
    void loadTopics();
  }, [refreshProgress, loadTopics, storageKey]);

  const revealHistoryAnswer = useCallback(
    async (questionId: string, regenerate: boolean) => {
      if (historyAnswerLoading) return;
      setHistoryAnswerLoading(questionId);
      setError(null);
      try {
        const res = regenerate
          ? await api.post(`/sessions/question/${questionId}/generate-answer`)
          : await api.get(`/sessions/question/${questionId}/answer`);
        setHistoryAnswers((prev) => ({ ...prev, [questionId]: res.data.data }));
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || 'Could not load the answer. Try again.');
      } finally {
        setHistoryAnswerLoading(null);
      }
    },
    [historyAnswerLoading]
  );

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-background">
        {authLoading ? (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary" />
        ) : (
          <Card className="max-w-md"><CardContent className="p-8 text-center">
            <p className="text-brand-textSecondary">Sign in to practice topics.</p>
            <Link href="/login" className="mt-4 inline-block text-brand-secondary hover:underline">Sign in</Link>
          </CardContent></Card>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Practice view
  // ------------------------------------------------------------------
  if (practice) {
    const doneCount = practice.questions.filter((q) => ['ANSWERED', 'SKIPPED'].includes(q.status)).length;
    const isCoding = !!current?.isCoding;
    return (
      <div className="min-h-screen bg-brand-background py-8 px-4">
        <div className="mx-auto max-w-3xl">
          <button onClick={endPractice} className="text-sm text-brand-secondary hover:underline mb-4">
            {source ? '← Back to this entry' : '← All topics'}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h1 className="text-2xl font-bold text-brand-primary">
              {practice.topic} Interview Practice
            </h1>
            <p className="text-sm text-brand-textSecondary">
              {doneCount} / {practice.questions.length} resolved
            </p>
          </div>
          <p className="text-sm text-brand-textSecondary mb-2">
            {practice.selection.difficulties.length
              ? `Difficulty: ${practice.selection.difficulties.join(', ')}`
              : 'Difficulty: Mixed'}
            {' · '}
            {practice.selection.questionTypes.length
              ? `Type: ${practice.selection.questionTypes.join(', ')}`
              : 'Type: Mixed'}
          </p>
          <Progress value={doneCount} max={practice.questions.length || 1} className="mb-6" />

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded border border-red-200">
              <p>{error}</p>
            </div>
          )}
          {notice && !error && (
            <div className="mb-4 p-3 bg-brand-secondary/5 text-brand-text rounded border border-brand-border">
              <p className="text-sm">{notice}</p>
            </div>
          )}

          {current && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={current.difficulty === 'EASY' ? 'success' : current.difficulty === 'HARD' || current.difficulty === 'EXPERT' ? 'warning' : 'primary'}>
                    {current.difficulty}
                  </Badge>
                  <Badge variant="neutral">{current.subtopic || current.questionType}</Badge>
                  {isCoding && <Badge variant="primary">Coding</Badge>}
                  {current.isSystemDesign && <Badge variant="primary">System design</Badge>}
                  {current.estimatedTimeSeconds ? (
                    <Badge variant="neutral">~{Math.round(current.estimatedTimeSeconds / 60)} min</Badge>
                  ) : null}
                  {current.status === 'SKIPPED' && <Badge variant="neutral">Skipped</Badge>}
                  <span className="ml-auto text-xs text-brand-textSecondary">
                    Question {practice.currentIndex + 1} of {practice.questions.length}
                  </span>
                </div>
                <CardTitle className="text-xl leading-relaxed">{current.question}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Coding questions keep their full description visible. */}
                {isCoding && current.codingProblem?.description && (
                  <section className="mb-4 rounded-lg border border-brand-border bg-brand-background p-4">
                    <h4 className="text-sm font-semibold text-brand-primary">Problem</h4>
                    <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">
                      {current.codingProblem.description}
                    </p>
                    {current.codingProblem.constraints?.length > 0 && (
                      <>
                        <h4 className="mt-3 text-sm font-semibold text-brand-primary">Constraints</h4>
                        <ul className="mt-1 list-disc list-inside text-sm text-brand-text">
                          {current.codingProblem.constraints.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </>
                    )}
                    {current.codingProblem.examples?.length > 0 && (
                      <>
                        <h4 className="mt-3 text-sm font-semibold text-brand-primary">Examples</h4>
                        {current.codingProblem.examples.map((ex, i) => (
                          <div key={i} className="mt-2 text-sm">
                            <p><span className="font-medium">Input:</span> <code className="bg-brand-background rounded px-1">{ex.input}</code></p>
                            <p><span className="font-medium">Output:</span> <code className="bg-brand-background rounded px-1">{ex.output}</code></p>
                          </div>
                        ))}
                      </>
                    )}
                  </section>
                )}

                {current.concepts?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {current.concepts.map((c) => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-brand-background text-brand-textSecondary">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Feedback options */}
                <label className="block mb-4 text-sm" htmlFor="topic-feedback">
                  Feedback
                  <select
                    id="topic-feedback"
                    className="block border rounded p-2 mt-1"
                    defaultValue=""
                    disabled={feedbackBusy}
                    onChange={async (e) => {
                      const kind = e.target.value;
                      if (!kind) return;
                      await sendFeedback(kind);
                      e.target.value = '';
                    }}
                  >
                    <option value="" disabled>Choose feedback</option>
                    {FEEDBACK_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                {!revealed ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Button onClick={() => revealAnswer(true)} isLoading={answerLoading}>
                      Generate Interview Answer
                    </Button>
                    <Button variant="secondary" onClick={() => revealAnswer(false)} isLoading={answerLoading}>
                      Show saved answer
                    </Button>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-brand-primary mb-3">Interview-ready answer</h3>
                    <AnswerView
                      answer={revealed}
                      hint={{
                        isCoding,
                        isSystemDesign: current.isSystemDesign,
                        difficulty: current.difficulty,
                        questionType: current.questionType,
                      }}
                    />
                  </div>
                )}

                {/* Navigation */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-4">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => goTo(practice.currentIndex - 1)} disabled={practice.currentIndex === 0}>
                      &larr; Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => goTo(practice.currentIndex + 1)}
                      disabled={practice.currentIndex >= practice.questions.length - 1}
                    >
                      Next &rarr;
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={skipQuestion}
                      isLoading={skipLoading}
                      disabled={current.status === 'SKIPPED'}
                      title={current.status === 'SKIPPED' ? 'Already skipped' : 'Resolve this question without answering it'}
                    >
                      {current.status === 'SKIPPED' ? 'Skipped' : 'Skip'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={generateNewQuestion} isLoading={newQuestionLoading}>
                      Generate new question
                    </Button>
                    <Button variant="ghost" size="sm" onClick={endPractice}>
                      End practice
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question dots */}
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {practice.questions.map((item, i) => (
              <button
                key={item.id}
                onClick={() => goTo(i)}
                aria-label={`Question ${i + 1}: ${item.status}`}
                aria-current={i === practice.currentIndex}
                title={`Question ${i + 1} — ${item.status === 'ANSWERED' ? 'answered' : item.status === 'SKIPPED' ? 'skipped' : 'not yet resolved'}`}
                className={cn(
                  'w-8 h-8 rounded-full text-xs font-medium transition-colors',
                  item.status === 'ANSWERED'
                    ? 'bg-emerald-500 text-white'
                    : item.status === 'SKIPPED'
                      ? 'bg-slate-300 text-slate-600 line-through'
                      : i === practice.currentIndex
                        ? 'bg-brand-secondary text-white ring-2 ring-brand-secondary/30'
                        : 'bg-white border border-brand-border text-brand-textSecondary hover:border-brand-secondary'
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Topic detail view — every question filed under the topic
  // ------------------------------------------------------------------
  if (activeTopic) {
    return (
      <div className="min-h-screen bg-brand-background py-8 px-4">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => { setActiveTopic(null); setTopicQuestions(null); setError(null); }}
            className="text-sm text-brand-secondary hover:underline mb-4"
          >
            {source ? '← Back to this entry' : '← All topics'}
          </button>
          <h1 className="text-2xl font-bold text-brand-primary mb-1">{activeTopic}</h1>
          <p className="text-brand-textSecondary mb-6">
            {topicQuestions
              ? `${topicQuestions.length} question${topicQuestions.length === 1 ? '' : 's'} filed under this topic, including questions from topic practice.`
              : 'Loading questions…'}
          </p>

          {error && (
            <Card className="mb-4 border-red-200"><CardContent className="p-4 text-sm text-red-600">{error}</CardContent></Card>
          )}

          {topicQuestionsFailed && (
            <Card><CardContent className="p-5 text-sm text-red-600">
              Could not load this topic&apos;s questions. Refresh and try again.
            </CardContent></Card>
          )}

          {!topicQuestions && !topicQuestionsFailed && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}><CardContent className="p-5">
                  <div className="h-3 w-2/3 rounded bg-brand-border/30 animate-pulse mb-3" />
                  <div className="h-3 w-1/2 rounded bg-brand-border/30 animate-pulse" />
                </CardContent></Card>
              ))}
            </div>
          )}

          {topicQuestions && topicQuestions.length === 0 && (
            <Card><CardContent className="p-10 text-center text-brand-textSecondary">
              No questions filed under this topic yet. Start a practice session for it and the
              generated questions will appear here.
            </CardContent></Card>
          )}

          <div className="space-y-3">
            {(topicQuestions ?? []).map((q, index) => {
              const answer = topicAnswers[q._id];
              const loading = topicAnswerLoading === q._id;
              return (
                <Card key={q._id}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-brand-textSecondary">{index + 1}.</span>
                      <Badge variant={q.difficulty === 'EASY' ? 'success' : q.difficulty === 'HARD' || q.difficulty === 'EXPERT' ? 'warning' : 'primary'}>
                        {q.difficulty}
                      </Badge>
                      <Badge variant="neutral">{q.questionType}</Badge>
                      {q.isCoding && <Badge variant="primary">Coding</Badge>}
                      {q.isTopicPractice && <Badge variant="neutral">From practice</Badge>}
                      {q.estimatedAnswerTimeSeconds ? (
                        <Badge variant="neutral">~{Math.round(q.estimatedAnswerTimeSeconds / 60)} min</Badge>
                      ) : null}
                    </div>
                    <p className="text-brand-text leading-relaxed">{q.question}</p>
                    {q.concepts?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {q.concepts.map((c) => (
                          <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-brand-background text-brand-textSecondary">{c}</span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3">
                      {!answer ? (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" isLoading={loading} onClick={() => revealTopicAnswer(q._id, false)}>
                            Show Interview Answer
                          </Button>
                          <Button size="sm" variant="ghost" isLoading={loading} onClick={() => revealTopicAnswer(q._id, true)}>
                            Generate Answer
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <AnswerView
                            answer={answer}
                            hint={{ isCoding: q.isCoding, difficulty: q.difficulty, questionType: q.questionType }}
                          />
                          <Button size="sm" variant="ghost" className="mt-2" isLoading={loading} onClick={() => revealTopicAnswer(q._id, true)}>
                            Regenerate answer
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Topic picker view
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-brand-background py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-brand-primary mb-1">{source ? source.label : 'Topics'}</h1>
            <p className="text-brand-textSecondary">
              {source ? 'Practice explaining your actual work, decisions and claims. Saved questions and history below belong to this entry.' : 'Open any topic to see every question filed under it, or start a topic-wise practice session. Practice questions are saved under the topic you choose.'}
            </p>
          </div>
          <Button
            onClick={() => { setError(null); setNotice(null); setConfigOpen(true); }}
            className="shrink-0"
          >
            {source ? `Practice this ${source.kind}` : '+ Practice Topic Wise'}
          </Button>
        </div>

        {/* Resume an unfinished session */}
        {resumable && (
          <Card className="mb-6 border-brand-secondary/40">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-brand-primary">
                  Resume practice — {resumable.topic}, question {resumable.currentIndex + 1} of{' '}
                  {resumable.questions.length}
                </p>
                <p className="text-xs text-brand-textSecondary">
                  Your in-progress session was saved on this device.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setPractice(resumable); setResumable(null); }}>
                  Resume practice
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setResumable(null);
                    try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
                  }}
                >
                  Discard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {failed && (
          <Card className="mb-6"><CardContent className="p-5 text-sm text-red-600">
            Could not load topics. Check that the backend is running, then refresh.
          </CardContent></Card>
        )}

        {notice && !error && (
          <Card className="mb-6"><CardContent className="p-4 text-sm text-brand-text">{notice}</CardContent></Card>
        )}
        {error && !configOpen && (
          <Card className="mb-6 border-red-200">
            <CardContent className="p-4 text-sm text-red-600">{error}</CardContent>
          </Card>
        )}

        {/* Per-topic practice history */}
        <div className="mb-8">
          <button
            className="text-sm text-brand-secondary hover:underline"
            onClick={() => {
              const next = !showHistory;
              setShowHistory(next);
              if (next && !history.length) loadHistory('all');
            }}
          >
            {showHistory ? 'Hide practice history' : 'Show practice history'}
          </button>
          {showHistory && (
            <Card className="mt-3">
              <CardContent className="p-5">
                {historyLoading ? (
                  <p className="text-sm text-brand-textSecondary">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="text-sm text-brand-textSecondary">No practice history yet.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {history.map((h) => {
                      const answer = historyAnswers[h.questionId];
                      return (
                        <div key={h.id} className="py-2 border-b border-brand-border last:border-0">
                          <p className="text-sm text-brand-text">{h.question}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="neutral">{h.topic}</Badge>
                            {h.difficulty && <Badge variant="neutral">{h.difficulty.toLowerCase()}</Badge>}
                            <Badge variant={h.status === 'ANSWERED' ? 'success' : h.status === 'SKIPPED' ? 'warning' : 'neutral'}>
                              {h.status.toLowerCase()}
                            </Badge>
                            {typeof h.finalScore === 'number' && (
                              <span className="text-[10px] font-medium text-brand-primary">
                                {Math.round(h.finalScore * 100)}%
                              </span>
                            )}
                          </div>
                          {h.questionId && (
                            <div className="mt-2">
                              {!answer ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    isLoading={historyAnswerLoading === h.questionId}
                                    onClick={() => revealHistoryAnswer(h.questionId, false)}
                                  >
                                    Show Interview Answer
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    isLoading={historyAnswerLoading === h.questionId}
                                    onClick={() => revealHistoryAnswer(h.questionId, true)}
                                  >
                                    Generate Answer
                                  </Button>
                                </div>
                              ) : (
                                <AnswerView
                                  answer={answer}
                                  hint={{ difficulty: h.difficulty }}
                                  className="mt-1"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {!topics && !failed && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6">
                <div className="h-5 w-1/2 rounded bg-brand-border/40 animate-pulse mb-4" />
                <div className="h-3 w-full rounded bg-brand-border/30 animate-pulse mb-2" />
                <div className="h-3 w-2/3 rounded bg-brand-border/30 animate-pulse" />
              </CardContent></Card>
            ))}
          </div>
        )}

        {topics && topics.length === 0 && (
          <Card><CardContent className="p-10 text-center text-brand-textSecondary">
            No approved questions yet. Start a Practice Topic Wise session to generate them.
          </CardContent></Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(topics ?? []).map((t) => {
            const p = progressFor(t.topic);
            const isCoding = t.topic === 'Coding';
            return (
              <button
                key={t.topic}
                type="button"
                onClick={() => openTopic(t.topic)}
                className="text-left h-full"
              >
                <Card className="card-hover h-full transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{t.topic}</span>
                      <Badge variant="primary">{t.total}</Badge>
                    </CardTitle>
                    {isCoding && (
                      <p className="text-xs text-brand-textSecondary">
                        Coding problems with statement, constraints and examples as their own topic.
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {t.topic !== 'Coding' && (
                      <div className="flex gap-3 mb-2 text-xs text-brand-textSecondary">
                        <span>{t.counts.EASY} easy</span>
                        <span>{t.counts.MEDIUM} medium</span>
                        <span>{t.counts.HARD} hard</span>
                        <span>{t.counts.EXPERT} expert</span>
                      </div>
                    )}
                    {p && (
                      <p className="text-xs text-brand-textSecondary mb-2">
                        {p.answered} answered · {p.skipped} skipped
                        {typeof p.averageScore === 'number' ? ` · avg ${Math.round(p.averageScore * 100)}%` : ''}
                      </p>
                    )}
                    {t.concepts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {t.concepts.slice(0, 5).map((c) => (
                          <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-brand-background text-brand-textSecondary truncate max-w-[140px]">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-sm text-brand-secondary">View questions →</span>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      {configOpen && (
        <PracticeConfigDialog
          skills={skills}
          fixedTopic={source?.label.slice(0, 120)}
          busy={startingPractice}
          error={error}
          onStart={startPractice}
          onClose={() => { setConfigOpen(false); setError(null); }}
        />
      )}
    </div>
  );
}


