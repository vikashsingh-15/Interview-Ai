'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import api from '@/lib/api';
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

interface RevealedAnswer {
  sections?: StructuredAnswer;
  legacyAnswer?: string;
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
  const [completing, setCompleting] = useState(false);
  const [retryingQuestions, setRetryingQuestions] = useState(false);
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

      const firstUnanswered = flat.findIndex((q) => q.status !== 'answered' && q.status !== 'reviewed');
      setCurrentIndex(firstUnanswered === -1 ? flat.length : firstUnanswered);
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
  const answeredCount = useMemo(() => questions.filter((q) => q.status === 'answered' || q.status === 'reviewed').length, [questions]);

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

  const markReviewed = async () => {
    if (!session || !currentQuestion || !revealedAnswers[currentQuestion.id] || markingReviewed) return;
    setMarkingReviewed(true);
    setError(null);
    try {
      const res = await api.post(`/sessions/${session.sessionId}/questions/${currentQuestion.id}/review`);
      setQuestions(prev => prev.map(q => q.id === currentQuestion.id ? { ...q, status:'reviewed' } : q));
      setSession(prev => prev ? { ...prev, completedQuestions:res.data.data.completedQuestions } : prev);
      setCurrentIndex(i => Math.min(i+1, questions.length));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not mark this question reviewed.');
    } finally {
      setMarkingReviewed(false);
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
        {/* Progress header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-brand-textSecondary">
              Day {session?.userDayNumber} — {typeLabel} section
            </p>
            <p className="text-sm text-brand-textSecondary">
              {answeredCount} / {questions.length} reviewed
            </p>
          </div>
          <Progress value={answeredCount} max={questions.length || 1} />
        </div>

        {/* Spaced revision plan: due +1/+7/+14/+30 day buckets with reveal answers */}
        <RevisionSchedule />

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
            {!revealedAnswers[q.id] ? (
              <Button onClick={revealAnswer} isLoading={revealing}>Show detailed answer</Button>
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
          </CardContent>
        </Card>

        {/* Question dots */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {questions.map((item, i) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.status === 'answered' || item.status === 'reviewed' || i <= currentIndex) {
                  setCurrentIndex(i);
                }
              }}
              title={item.status === 'reviewed' ? 'Reviewed' : 'Question ' + (i + 1)}
              className={cn(
                'w-8 h-8 rounded-full text-xs font-medium transition-colors',
                item.status === 'answered' || item.status === 'reviewed'
                  ? 'bg-emerald-500 text-white'
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
