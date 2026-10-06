'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import api, { logQuestionGenerationError } from '@/lib/api';
import { RevisionSchedule } from '@/components/revision/RevisionSchedule';
import { cn } from '@/lib/utils';

interface QuestionItem {
  id: string;
  order: number;
  status: string;
  question: string;
  topic: string;
  subtopic: string;
  concepts: string[];
  difficulty: string;
  questionType: string;
  estimatedTimeSeconds?: number;
  isRevision: boolean;
  revisionNumber?: number;
  isSystemDesign: boolean;
  isCoding: boolean;
  isProjectInterview: boolean;
  finalScore?: number;
  sectionTitle: string;
  sectionType: string;
}

interface SessionDetail {
  sessionId: string;
  userDayNumber: number;
  status: string;
  generationState?: 'generating' | 'completed' | 'failed';
  generationMessage?: string;
  totalQuestions: number;
  completedQuestions: number;
  averageScore: number;
  sections: {
    id: string;
    type: string;
    title: string;
    totalQuestions: number;
    completedQuestions: number;
    /** Backend explanation for a short, empty or unconfirmed section. */
    notes?: string;
    questions: Omit<QuestionItem, 'sectionTitle' | 'sectionType'>[];
  }[];
}

interface StructuredAnswer {
  direct: string;
  questionFocus: string;
  why: string;
  how: string;
  example: string;
  tradeOff: string;
  summary: string;
}

interface DetailedAnswer {
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

interface RevealedAnswer {
  sections?: StructuredAnswer;
  legacyAnswer?: string;
  detailed?: DetailedAnswer;
}

export default function TodaySessionPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, RevealedAnswer>>({});
  const [revealing, setRevealing] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [retryingQuestions, setRetryingQuestions] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      redirect('/login');
    }
  }, [isAuthenticated, authLoading]);

  const loadSession = useCallback(async () => {
    try {
      const todayRes = await api.get('/sessions/today');
      const { sessionId } = todayRes.data.data;

      const detailRes = await api.get(`/sessions/${sessionId}`);
      const detail: SessionDetail = detailRes.data.data;
      setSession(detail);
      setError(null);

      const flat: QuestionItem[] = [];
      for (const section of detail.sections || []) {
        for (const q of section.questions || []) {
          flat.push({ ...q, sectionTitle: section.title, sectionType: section.type });
        }
      }
      flat.sort((a, b) => a.order - b.order);
      setQuestions(flat);

      const requestedQuestionId = new URLSearchParams(window.location.search).get('questionId');
      const requestedQuestionIndex = requestedQuestionId
        ? flat.findIndex((question) => question.id === requestedQuestionId)
        : -1;
      const firstUnanswered = flat.findIndex((q) => !['answered', 'reviewed', 'skipped'].includes(q.status));
      // Stay on a real question even when everything is done: the navigation
      // controls and dots must keep working instead of the card vanishing.
      setCurrentIndex(requestedQuestionIndex >= 0
        ? requestedQuestionIndex
        : firstUnanswered === -1 ? Math.max(flat.length - 1, 0) : firstUnanswered);
      return detail;
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load today\u2019s session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadSession();
    }
  }, [isAuthenticated, loadSession]);

  useEffect(() => {
    if (session?.generationState !== 'generating') return;
    const timer = setInterval(() => { void loadSession(); }, 5000);
    return () => clearInterval(timer);
  }, [session?.generationState, loadSession]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(() => questions.filter((q) => ['answered', 'reviewed', 'skipped'].includes(q.status)).length, [questions]);
  const pendingCount = questions.length - answeredCount;
  const allDone = questions.length > 0 && answeredCount === questions.length;
  /** Sections that produced nothing: a real gap the user needs to know about. */
  const emptySections = useMemo(
    () => (session?.sections || []).filter((s) => s.totalQuestions === 0),
    [session],
  );
  /** Notes on sections that did generate; context, not a failure. */
  const sectionNotes = useMemo(
    () => (session?.sections || []).filter((s) => s.totalQuestions > 0 && s.notes),
    [session],
  );

  // Previous/Next were the missing control: they must work from any position,
  // including revisiting a question already answered or skipped.
  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, questions.length - 1)));
  }, [questions.length]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  const revealAnswer = async () => {
    if (!session || !currentQuestion || revealing) return;
    setRevealing(true);
    setError(null);
    try {
      const res = await api.get(`/sessions/${session.sessionId}/questions/${currentQuestion.id}/answer`);
      setRevealedAnswers(prev => ({ ...prev, [currentQuestion.id]: res.data.data }));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not load the answer. Try again.');
    } finally {
      setRevealing(false);
    }
  };

  /** Generate a detailed answer on demand for the current question. */
  const generateAnswer = async () => {
    if (!session || !currentQuestion) return;
    setRevealing(true);
    setError(null);
    try {
      const res = await api.post(`/sessions/${session.sessionId}/questions/${currentQuestion.id}/generate-answer`);
      setRevealedAnswers(prev => ({ ...prev, [currentQuestion.id]: res.data.data }));
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Could not generate the answer. Check your AI provider settings and retry.';
      setError(message);
      // If the answer was not found, offer to try the GET route (cached).
      if (err?.response?.data?.error?.code === 'NOT_FOUND') {
        setTimeout(() => {
          setError(null);
          void revealAnswer();
        }, 800);
      }
    } finally {
      setRevealing(false);
    }
  };

  const markReviewed = async () => {
    if (!session || !currentQuestion || !revealedAnswers[currentQuestion.id] || markingReviewed) return;
    setMarkingReviewed(true);
    setError(null);
    try {
      const res = await api.post(`/sessions/${session.sessionId}/questions/${currentQuestion.id}/review`);
      setQuestions(prev => prev.map(q => q.id === currentQuestion.id ? { ...q, status:'reviewed' } : q));
      setSession(prev => prev ? { ...prev, completedQuestions:res.data.data.completedQuestions } : prev);
      setCurrentIndex(i => Math.min(i+1, Math.max(questions.length - 1, 0)));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not mark this question reviewed.');
    } finally {
      setMarkingReviewed(false);
    }
  };

  const skipQuestion = async () => {
    if (!session || !currentQuestion || skipping) return;
    setSkipping(true);
    setError(null);
    try {
      const res = await api.post(`/sessions/${session.sessionId}/questions/${currentQuestion.id}/skip`);
      setQuestions(prev => prev.map(q => q.id === currentQuestion.id ? { ...q, status:'skipped' } : q));
      setSession(prev => prev ? { ...prev, completedQuestions:res.data.data.completedQuestions ?? prev.completedQuestions } : prev);
      setCurrentIndex(i => {
        const next = questions.findIndex((q, idx) => idx > i && q.status !== 'answered' && q.status !== 'reviewed' && q.status !== 'skipped');
        return next === -1 ? Math.max(questions.length - 1, 0) : next;
      });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not skip this question. Try again.');
    } finally {
      setSkipping(false);
    }
  };

  const regenerateQuestions = async () => {
    if (!session || regenerating) return;
    setRegenerating(true);
    setError(null);
    try {
      await api.post('/sessions/today/regenerate');
      await loadSession();
    } catch (err: any) {
      const latest = await loadSession();
      if (!latest || latest.generationState === 'failed') {
        setError(logQuestionGenerationError('today.regenerate', err));
      }
    } finally {
      setRegenerating(false);
    }
  };

  const retryQuestionGeneration = async () => {
    if (!session || retryingQuestions) return;
    setRetryingQuestions(true);
    setIsLoading(true);
    setError(null);
    try {
      await api.post('/sessions/generate', { retryEmpty: true });
      await loadSession();
    } catch (err: any) {
      // A proxy may time out while the backend is still generating. Read its
      // current state instead of retaining an old provider's error message.
      const latest = await loadSession();
      if (!latest || latest.generationState === 'failed') {
        setError(latest?.generationMessage || err?.response?.data?.error?.message || err?.response?.data?.message || 'Could not retrieve generation status. Refresh to check again.');
      }
      setIsLoading(false);
    } finally {
      setRetryingQuestions(false);
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    setCompleting(true);
    try {
      await api.post(`/sessions/${session.sessionId}/complete`);
      setCompleted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to complete session');
    } finally {
      setCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary"></div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <Link href="/dashboard" className="mt-4 inline-block text-brand-secondary hover:underline">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Session complete summary ----
  if (completed) {
    return (
      <div className="min-h-screen bg-brand-background py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="mt-6 text-3xl font-bold text-brand-primary">Session complete!</h1>
              <p className="mt-2 text-brand-textSecondary">
                You reviewed {questions.length} question{questions.length === 1 ? '' : 's'} today.
              </p>
              <div className="mt-8 flex gap-3 justify-center">
                <Link href="/dashboard">
                  <Button>Back to dashboard</Button>
                </Link>
                <Link href="/calendar">
                  <Button variant="secondary">View calendar</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Empty session: generation did not produce questions ----
  if (!currentQuestion && questions.length === 0) {
    const generating = session?.generationState === 'generating';
    return (
      <div className="min-h-screen bg-brand-background py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-10 text-center">
              <h1 className="text-2xl font-bold text-brand-primary">
                {generating ? 'Generating questions' : 'No questions generated yet'}
              </h1>
              <p className="mt-2 text-brand-textSecondary">
                {session?.generationMessage || 'This session does not have any questions yet. Check your AI provider settings, then retry.'}
              </p>
              {error && error !== session?.generationMessage && (
                <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>
              )}
              <div className="mt-8 flex gap-3 justify-center">
                <Button onClick={retryQuestionGeneration} isLoading={retryingQuestions} disabled={generating}>
                  {generating ? 'Generation in progress' : 'Retry question generation'}
                </Button>
                <Link href="/dashboard">
                  <Button variant="secondary">Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- All reviewed ----
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-brand-background py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-10 text-center">
              <h1 className="text-2xl font-bold text-brand-primary">All questions reviewed</h1>
              <p className="mt-2 text-brand-textSecondary">
                {answeredCount} question{answeredCount === 1 ? '' : 's'} reviewed today.
              </p>
              <div className="mt-8 flex gap-3 justify-center">
                <Button onClick={handleComplete} isLoading={completing}>
                  Complete session
                </Button>
                <Link href="/dashboard">
                  <Button variant="secondary">Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const q = currentQuestion;
  const typeLabel = q.isCoding ? 'Coding' : q.isSystemDesign ? 'System Design' : q.isProjectInterview ? 'Project' : q.sectionType === 'revision' ? 'Revision' : 'Technical';

  return (
    <div className="min-h-screen bg-brand-background py-8 px-4">
      <div className="mx-auto max-w-3xl">
        {/* Progress header with regenerate action */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-brand-textSecondary">
              Day {session?.userDayNumber} — {typeLabel} section
            </p>
            <div className="flex items-center gap-3">
              <p className="text-sm text-brand-textSecondary">
                {answeredCount} / {questions.length} reviewed
                {pendingCount > 0 && <span className="ml-1">({pendingCount} still open)</span>}
              </p>
              <button
                onClick={regenerateQuestions}
                disabled={regenerating || session?.generationState === 'generating'}
                title="Replace unanswered questions with a fresh set from your current settings. Answered and skipped questions stay."
                className="text-xs font-medium text-brand-secondary hover:text-brand-primary underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
              >
                {regenerating ? 'Regenerating…' : 'Regenerate fresh set'}
              </button>
            </div>
          </div>
          <Progress value={answeredCount} max={questions.length || 1} />
           {error && (
             <div className="mb-4 p-3 bg-red-50 text-red-600 rounded border border-red-200">
               <p>{error}</p>
             </div>
           )}
        </div>

        {/* Spaced revision plan: due +1/+7/+14/+30 day buckets with reveal answers */}
        <RevisionSchedule />

        {/* Only a section that produced nothing is an error; a note on a section
            that did generate is context, so it must not read as a failure. */}
        {emptySections.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {emptySections.length === 1 ? 'A section could not be generated' : `${emptySections.length} sections could not be generated`}
            </p>
            <ul className="mt-2 space-y-1.5">
              {emptySections.map((s) => (
                <li key={s.id} className="text-sm text-amber-900">
                  <span className="font-medium">{s.title}</span> — 0 questions.
                  {s.notes && <span className="block text-amber-800">{s.notes}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-800">
              Press “Regenerate fresh set” to try again with the current settings.
            </p>
          </div>
        )}
        {sectionNotes.length > 0 && (
          <div className="mb-4 rounded-lg border border-brand-border bg-brand-background p-4">
            <p className="text-sm font-semibold text-brand-primary">About these sections</p>
            <ul className="mt-2 space-y-1.5">
              {sectionNotes.map((s) => (
                <li key={s.id} className="text-sm text-brand-textSecondary">
                  <span className="font-medium text-brand-primary">{s.title}</span> —{' '}
                  {s.totalQuestions} question{s.totalQuestions === 1 ? '' : 's'}.
                  {s.notes && <span className="block">{s.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Question card */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{typeLabel}</Badge>
              <Badge variant="neutral">{q.difficulty}</Badge>
              {q.isRevision && <Badge variant="neutral">Revision pass</Badge>}
              {q.status === 'skipped' && <Badge variant="neutral">Skipped</Badge>}
              {q.estimatedTimeSeconds ? <Badge variant="neutral">~{Math.round(q.estimatedTimeSeconds / 60)} min</Badge> : null}
            </div>
            <CardTitle className="text-xl leading-relaxed">{q.question}</CardTitle>
            {q.concepts?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {q.concepts.map((c) => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-brand-background text-brand-textSecondary">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <label className="block mb-4 text-sm" htmlFor="question-feedback">Feedback
              <select id="question-feedback" className="block border rounded p-2 mt-1" defaultValue="" onChange={async e=>{
                const kind=e.target.value;if(!kind || !session) return;
                try { await api.post('/feedback/'+session.sessionId+'/'+q.id,{kind});setError('Feedback saved'); }
                catch { setError('Could not save feedback'); }
              }}>
                <option value="" disabled>Choose feedback</option>
                {['too_easy','too_hard','already_know','not_relevant','duplicate','incorrect','need_revision','skipped'].map(v=><option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
              </select>
            </label>
            {!revealedAnswers[q.id] ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={revealAnswer} isLoading={revealing}>
                  {revealing ? 'Loading answer…' : 'Show detailed answer'}
                </Button>
                <Button onClick={generateAnswer} isLoading={revealing}>
                  {revealing ? 'Generating…' : 'Generate answer'}
                </Button>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold text-brand-primary">Interview-ready answer</h3>
                {revealedAnswers[q.id].sections ? (
                  <div className="mt-3 space-y-4">
                    {([
                      ['Direct answer', 'direct'],
                      ['What the question asks', 'questionFocus'],
                      ['Why', 'why'],
                      ['How', 'how'],
                      ['Concrete example', 'example'],
                      ['Trade-off', 'tradeOff'],
                      ['Summary', 'summary'],
                    ] as const).map(([label, key]) => (
                      <section key={key} className="rounded-lg border border-brand-border bg-brand-background p-4">
                        <h4 className="text-sm font-semibold text-brand-primary">{label}</h4>
                        <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">
                          {revealedAnswers[q.id].sections![key]}
                        </p>
                      </section>
                    ))}
                    {revealedAnswers[q.id].detailed && (
                      <div className="mt-6 pt-4 border-t border-brand-border space-y-4">
                        <h3 className="text-base font-semibold text-brand-primary">Detailed study guide</h3>
                        <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                          <h4 className="text-sm font-semibold text-brand-primary">Overview</h4>
                          <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{revealedAnswers[q.id].detailed!.overview}</p>
                        </section>
                        <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                          <h4 className="text-sm font-semibold text-brand-primary">Key points</h4>
                          <ul className="mt-2 text-sm leading-7 text-brand-text space-y-1.5 list-disc list-inside">
                            {revealedAnswers[q.id].detailed!.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        </section>
                        <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                          <h4 className="text-sm font-semibold text-brand-primary">Algorithm / approach</h4>
                          <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{revealedAnswers[q.id].detailed!.algorithmOrApproach}</p>
                        </section>
                        {revealedAnswers[q.id].detailed!.codeSketch && (
                          <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                            <h4 className="text-sm font-semibold text-brand-primary">Code sketch</h4>
                            <pre className="mt-2 text-xs leading-6 text-brand-text whitespace-pre-wrap font-mono bg-brand-background rounded p-3 overflow-x-auto">{revealedAnswers[q.id].detailed!.codeSketch}</pre>
                          </section>
                        )}
                        <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                          <h4 className="text-sm font-semibold text-brand-primary">Complexity / trade-offs</h4>
                          <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{revealedAnswers[q.id].detailed!.complexity}</p>
                        </section>
                        <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                          <h4 className="text-sm font-semibold text-brand-primary">Edge cases</h4>
                          <ul className="mt-2 text-sm leading-7 text-brand-text space-y-1.5 list-disc list-inside">
                            {revealedAnswers[q.id].detailed!.edgeCases.map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        </section>
                        <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                          <h4 className="text-sm font-semibold text-brand-primary">Common mistakes</h4>
                          <ul className="mt-2 text-sm leading-7 text-brand-text space-y-1.5 list-disc list-inside">
                            {revealedAnswers[q.id].detailed!.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}
                          </ul>
                        </section>
                        <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                          <h4 className="text-sm font-semibold text-brand-primary">Why it matters</h4>
                          <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{revealedAnswers[q.id].detailed!.whyItMatters}</p>
                        </section>
                        {revealedAnswers[q.id].detailed!.followUpQuestions.length > 0 && (
                          <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                            <h4 className="text-sm font-semibold text-brand-primary">Likely follow-ups</h4>
                            <ul className="mt-2 text-sm leading-7 text-brand-text space-y-1.5 list-disc list-inside">
                              {revealedAnswers[q.id].detailed!.followUpQuestions.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </section>
                        )}
                        <section className="rounded-lg border border-brand-border bg-brand-background p-4">
                          <h4 className="text-sm font-semibold text-brand-primary">Takeaway</h4>
                          <p className="mt-2 text-sm leading-7 text-brand-text whitespace-pre-wrap">{revealedAnswers[q.id].detailed!.summary}</p>
                        </section>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-brand-border bg-brand-background p-5 text-sm leading-7 text-brand-text whitespace-pre-wrap">
                    {revealedAnswers[q.id].legacyAnswer}
                  </div>
                )}
                {q.status !== 'answered' && q.status !== 'reviewed' && (
                  <div className="mt-5 flex justify-end">
                    <Button onClick={markReviewed} isLoading={markingReviewed}>Mark reviewed and continue</Button>
                  </div>
                )}
              </div>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

            {/* Navigation is always available: the dots alone never allowed
                moving forward past the current question. */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-4">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
                  &larr; Previous
                </Button>
                <Button variant="secondary" size="sm" onClick={goNext} disabled={currentIndex >= questions.length - 1}>
                  Next &rarr;
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-brand-textSecondary">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipQuestion}
                  isLoading={skipping}
                  disabled={q.status === 'answered' || q.status === 'reviewed' || q.status === 'skipped'}
                  title={q.status === 'skipped' ? 'Already skipped' : 'Resolve this question without answering it'}
                >
                  {q.status === 'skipped' ? 'Skipped' : 'Skip question'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {allDone && (
          <Card className="mt-6">
            <CardContent className="p-6 text-center">
              <h2 className="text-lg font-bold text-brand-primary">All questions reviewed</h2>
              <p className="mt-1 text-sm text-brand-textSecondary">
                {answeredCount} question{answeredCount === 1 ? '' : 's'} reviewed today. Use the dots above to revisit any of them.
              </p>
              <div className="mt-4 flex gap-3 justify-center">
                <Button onClick={handleComplete} isLoading={completing}>Complete session</Button>
                <Link href="/dashboard"><Button variant="secondary">Dashboard</Button></Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Question dots: every dot is a valid target. */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {questions.map((item, i) => (
            <button
              key={item.id}
              onClick={() => goTo(i)}
              aria-label={`Question ${i + 1}: ${item.status}`}
              aria-current={i === currentIndex}
              title={`Question ${i + 1} — ${
                item.status === 'reviewed' ? 'reviewed'
                : item.status === 'answered' ? 'answered'
                : item.status === 'skipped' ? 'skipped'
                : item.status === 'presented' ? 'not yet answered'
                : 'not started'}`}
              className={cn(
                'w-8 h-8 rounded-full text-xs font-medium transition-colors',
                item.status === 'answered' || item.status === 'reviewed'
                  ? 'bg-emerald-500 text-white'
                  : item.status === 'skipped'
                    ? 'bg-slate-300 text-slate-600 line-through'
                    : i === currentIndex
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
