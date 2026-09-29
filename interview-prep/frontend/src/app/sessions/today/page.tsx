'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Textarea } from '@/components/ui/Textarea';
import api from '@/lib/api';
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
    questions: Omit<QuestionItem, 'sectionTitle' | 'sectionType'>[];
  }[];
}

interface AnswerEvaluation {
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missingPoints: string[];
  improvementSuggestions: string[];
  keyConceptsToRevise: string[];
  strongerAnswerStructure?: string;
}

interface AnswerResult {
  score: number;
  evaluationSource: 'ai' | 'heuristic' | 'none';
  evaluation: AnswerEvaluation | null;
  scheduledForRevision: boolean;
  referenceAnswer: string | null;
}

function scoreColor(score: number): string {
  if (score >= 0.7) return 'text-emerald-600';
  if (score >= 0.4) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 0.7) return 'bg-emerald-100';
  if (score >= 0.4) return 'bg-amber-100';
  return 'bg-red-100';
}

export default function TodaySessionPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [retryingQuestions, setRetryingQuestions] = useState(false);
  const [completed, setCompleted] = useState<{ averageScore: number; correctQuestions: number } | null>(null);

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

      const flat: QuestionItem[] = [];
      for (const section of detail.sections || []) {
        for (const q of section.questions || []) {
          flat.push({ ...q, sectionTitle: section.title, sectionType: section.type });
        }
      }
      flat.sort((a, b) => a.order - b.order);
      setQuestions(flat);

      const firstUnanswered = flat.findIndex((q) => q.status !== 'answered');
      setCurrentIndex(firstUnanswered === -1 ? flat.length : firstUnanswered);
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

  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(() => questions.filter((q) => q.status === 'answered').length, [questions]);

  const handleSubmit = async () => {
    if (!session || !currentQuestion || answerText.trim().length < 10) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(
        `/sessions/${session.sessionId}/answers/${currentQuestion.id}`,
        { answer: answerText.trim() }
      );
      const data: AnswerResult = res.data.data;
      setResult(data);
      setShowReference(false);

      setQuestions((prev) =>
        prev.map((q, i) => (i === currentIndex ? { ...q, status: 'answered', finalScore: data.score } : q))
      );
      if (session) {
        setSession({ ...session, completedQuestions: session.completedQuestions + 1 });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setResult(null);
    setAnswerText('');
    setCurrentIndex((i) => Math.min(i + 1, questions.length));
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
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Could not generate questions. Check your AI provider settings and try again.');
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
      setCompleted({
        averageScore: session.averageScore,
        correctQuestions: questions.filter((q) => (q.finalScore ?? 0) >= 0.7).length,
      });
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
                You answered {questions.length} question{questions.length === 1 ? '' : 's'} today.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-brand-background p-4">
                  <p className="text-sm text-brand-textSecondary">Average score</p>
                  <p className={cn('text-2xl font-bold', scoreColor(completed.averageScore))}>
                    {Math.round((completed.averageScore || 0) * 100)}%
                  </p>
                </div>
                <div className="rounded-lg bg-brand-background p-4">
                  <p className="text-sm text-brand-textSecondary">Strong answers</p>
                  <p className="text-2xl font-bold text-brand-primary">
                    {completed.correctQuestions}/{questions.length}
                  </p>
                </div>
              </div>
              <div className="mt-8 flex gap-3 justify-center">
                <Link href="/dashboard">
                  <Button>Back to dashboard</Button>
                </Link>
                <Link href="/calendar">
                  <Button variant="secondary">View calendar</Button>
                </Link>
              </div>
              <p className="mt-6 text-xs text-brand-textSecondary">
                Weak answers (score &lt; 70%) were scheduled for spaced revision — they&apos;ll resurface in a
                future session.
              </p>
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

  // ---- All answered ----
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-brand-background py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-10 text-center">
              <h1 className="text-2xl font-bold text-brand-primary">All questions answered</h1>
              <p className="mt-2 text-brand-textSecondary">
                Nice work — {answeredCount} question{answeredCount === 1 ? '' : 's'} done today.
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
        {/* Progress header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-brand-textSecondary">
              Day {session?.userDayNumber} — {typeLabel} section
            </p>
            <p className="text-sm text-brand-textSecondary">
              {answeredCount} / {questions.length} answered
            </p>
          </div>
          <Progress value={answeredCount} max={questions.length || 1} />
        </div>

        {/* Question card */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{typeLabel}</Badge>
              <Badge variant="neutral">{q.difficulty}</Badge>
              {q.isRevision && <Badge variant="neutral">Revision pass</Badge>}
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
            <label className="block mb-4 text-sm">Feedback
              <select className="block border rounded p-2 mt-1" defaultValue="" onChange={async e=>{
                const kind=e.target.value;if(!kind || !session) return;
                try { await api.post('/feedback/'+session.sessionId+'/'+q.id,{kind});setError('Feedback saved'); }
                catch { setError('Could not save feedback'); }
              }}>
                <option value="" disabled>Choose feedback</option>
                {['too_easy','too_hard','already_know','not_relevant','duplicate','incorrect','need_revision','skipped'].map(v=><option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
              </select>
            </label>
            {!result ? (
              <>
                <Textarea
                  value={answerText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswerText(e.target.value)}
                  placeholder="Type your answer — explain your reasoning, trade-offs, and edge cases. The more detail, the better the evaluation."
                  rows={10}
                  className="w-full"
                />
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-brand-textSecondary">
                    {answerText.trim().length < 10
                      ? 'Minimum 10 characters'
                      : `Grading against a rubric${result === null ? '…' : ''}`}
                  </p>
                  <Button onClick={handleSubmit} disabled={answerText.trim().length < 10} isLoading={submitting}>
                    Submit answer
                  </Button>
                </div>
              </>
            ) : (
              /* ---- Evaluation result ---- */
              <div>
                <div className={cn('rounded-lg p-5', scoreBg(result.score))}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-brand-textSecondary">Your score</p>
                      <p className={cn('text-4xl font-bold', scoreColor(result.score))}>
                        {Math.round(result.score * 100)}%
                      </p>
                    </div>
                    <Badge variant="neutral">
                      {result.evaluationSource === 'ai' ? 'AI-graded' : result.evaluationSource === 'heuristic' ? 'Keyword-graded' : 'Ungraded'}
                    </Badge>
                  </div>
                  {result.evaluation?.summary && (
                    <p className="mt-3 text-sm text-brand-text">{result.evaluation.summary}</p>
                  )}
                </div>

                {result.scheduledForRevision && (
                  <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    📌 Scheduled for spaced revision — this question will resurface until you score 70%+.
                  </p>
                )}

                {result.evaluation && (
                  <div className="mt-4 space-y-4">
                    {result.evaluation.strengths.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">Strengths</p>
                        <ul className="mt-1 list-disc list-inside text-sm text-brand-text">
                          {result.evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {result.evaluation.weaknesses.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-red-700">Weaknesses</p>
                        <ul className="mt-1 list-disc list-inside text-sm text-brand-text">
                          {result.evaluation.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {result.evaluation.missingPoints.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-amber-700">Missing points</p>
                        <ul className="mt-1 list-disc list-inside text-sm text-brand-text">
                          {result.evaluation.missingPoints.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {result.evaluation.improvementSuggestions.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-brand-primary">How to improve</p>
                        <ul className="mt-1 list-disc list-inside text-sm text-brand-text">
                          {result.evaluation.improvementSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {result.evaluation.strongerAnswerStructure && (
                      <div className="rounded-lg bg-brand-background p-4">
                        <p className="text-sm font-semibold text-brand-primary">Stronger answer structure</p>
                        <p className="mt-1 text-sm text-brand-text">{result.evaluation.strongerAnswerStructure}</p>
                      </div>
                    )}
                  </div>
                )}

                {result.referenceAnswer && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowReference((v) => !v)}
                      className="text-sm font-medium text-brand-secondary hover:underline"
                    >
                      {showReference ? 'Hide' : 'Show'} reference answer
                    </button>
                    {showReference && (
                      <div className="mt-2 rounded-lg border border-brand-border p-4 text-sm text-brand-text whitespace-pre-wrap">
                        {result.referenceAnswer}
                      </div>
                    )}
                  </div>
                )}

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                <div className="mt-6 flex justify-end">
                  <Button onClick={handleNext}>
                    {currentIndex + 1 < questions.length ? 'Next question' : 'Finish'}
                    <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question dots */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {questions.map((item, i) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.status === 'answered' || i <= currentIndex) {
                  setResult(null);
                  setAnswerText('');
                  setCurrentIndex(i);
                }
              }}
              title={item.status === 'answered' ? `Scored ${Math.round((item.finalScore ?? 0) * 100)}%` : 'Question ' + (i + 1)}
              className={cn(
                'w-8 h-8 rounded-full text-xs font-medium transition-colors',
                item.status === 'answered'
                  ? (item.finalScore ?? 0) >= 0.7
                    ? 'bg-emerald-500 text-white'
                    : (item.finalScore ?? 0) >= 0.4
                      ? 'bg-amber-500 text-white'
                      : 'bg-red-500 text-white'
                  : i === currentIndex
                    ? 'bg-brand-secondary text-white ring-2 ring-brand-secondary/30'
                    : 'bg-white border border-brand-border text-brand-textSecondary'
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
