'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import api from '@/lib/api';
import { Session, Analytics } from '@/types';
import { formatDate, formatTime, calculateProgress, cn, truncate } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TrackerSection } from '@/components/tracker/TrackerSection';
import { PlannerSection } from '@/components/planner/PlannerSection';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenNote, setRegenNote] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [dashboardPanels, setDashboardPanels] = useState({ today: true, tracker: true, planner: false });
  const togglePanel = (panel: keyof typeof dashboardPanels) => setDashboardPanels((current) => ({ ...current, [panel]: !current[panel] }));

  const regenerateToday = async () => {
    if (regenerating) return;
    setRegenerating(true);
    setRegenNote(null);
    try {
      const res = await api.post('/sessions/today/regenerate');
      const sessionRes = await api.get('/sessions/today');
      setSession(sessionRes.data.data);
      setRegenNote(
        (res.data?.data?.totalQuestions ?? 0) === 0
          ? res.data?.data?.generationMessage || 'No new questions were generated.'
          : `Fresh set ready — ${res.data.data.totalQuestions} question${res.data.data.totalQuestions === 1 ? '' : 's'} for today.`,
      );
    } catch (error: any) {
      setRegenNote(error?.response?.data?.error?.message || error?.response?.data?.message
        || 'Could not regenerate. Try again in a moment.');
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const profileRes = await api.get('/profile/onboarding');
        if (!profileRes.data.data.profile?.onboardingCompleted) { router.replace('/onboarding'); return; }
        const [sessionRes, analyticsRes] = await Promise.all([
          api.get('/sessions/today'),
          api.get('/analytics/overview'),
        ]);
        setSession(sessionRes.data.data);
        setAnalytics(analyticsRes.data.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, user, authLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-brand-background">
      {/* Header */}
      <div className="bg-white border-b border-brand-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <h1 className="break-words text-3xl font-bold text-brand-primary">
                Welcome back, {user?.name}!
              </h1>
              <p className="mt-1 text-brand-textSecondary">
                {session?.userDayNumber
                  ? `Day ${session.userDayNumber} of your interview preparation`
                  : 'Get started with your first session'}
              </p>
            </div>

              <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={regenerateToday}
                disabled={regenerating}
                title="Replace today's unanswered questions with a fresh set built from your current settings. Answered and skipped questions are kept."
              >
                {regenerating ? 'Generating fresh set…' : 'Generate fresh questions'}
              </Button>
              {session?.userDayNumber && (
                <Link href="/sessions/today">
                  <button className="inline-flex items-center px-6 py-3 text-base font-medium rounded-lg bg-brand-secondary text-white hover:bg-brand-secondary/90 transition-colors shadow-sm">
                    Continue Day {session.userDayNumber}
                    <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <p className="mb-6"><Link href="/onboarding" className="text-blue-700 underline">Review resume, goals and daily plan</Link></p>
        {/* Stats Grid */}
        <div className="grid min-w-0 gap-6 lg:grid-cols-2 xl:grid-cols-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-brand-secondary/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-brand-textSecondary">Today&apos;s Progress</p>
                  <p className="text-2xl font-bold text-brand-primary">
                    {session?.completedQuestions ?? 0} / {session?.totalQuestions ?? 0} reviewed
                  </p>
                </div>
              </div>
              <Progress
                value={session?.completedQuestions ?? 0}
                max={session?.totalQuestions ?? 1}
                className="mt-4"
              />
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  onClick={regenerateToday}
                  disabled={regenerating}
                  title="Replace unanswered questions with a fresh set from your current settings. Answered and skipped questions stay."
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-brand-border text-brand-text hover:bg-brand-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regenerating ? 'Regenerating…' : 'Regenerate fresh set'}
                </button>
                <Link href="/settings" className="text-xs text-brand-textSecondary hover:text-brand-primary underline underline-offset-2">
                  Change question count
                </Link>
              </div>
              {regenNote && (
                <p className="mt-2 text-xs text-brand-textSecondary break-words">{regenNote}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-brand-textSecondary">Current Streak</p>
                  <p className="text-2xl font-bold text-brand-primary">
                    {analytics?.currentStreak || 0} days
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-brand-textSecondary">Average Score</p>
                  <p className="text-2xl font-bold text-brand-primary">
                    {(analytics?.averageScore || 0) * 100}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-brand-textSecondary">Due for Revision</p>
                  <p className="text-2xl font-bold text-brand-primary">
                    {analytics?.revisionProgress?.dueRevisions || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-4 overflow-hidden rounded-xl border border-brand-border bg-white shadow-sm">
          <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6" aria-expanded={dashboardPanels.today} onClick={() => togglePanel('today')}>
            <span><span className="block text-lg font-semibold text-brand-primary">Today</span><span className="block text-sm text-brand-textSecondary">Your session progress and question sections</span></span>
            <span className="shrink-0 text-xl text-brand-textSecondary" aria-hidden="true">{dashboardPanels.today ? '−' : '+'}</span>
          </button>
        </div>
        <div hidden={!dashboardPanels.today} className="min-w-0">
        {/* Session Overview */}
        {session && (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4 mb-8">
            {/* Technical Questions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Technical
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const technicalSection = session.sections?.find(s => s.type === 'technical');
                  const completed = technicalSection?.completedQuestions || 0;
                  const total = technicalSection?.totalQuestions || 0;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-semibold text-brand-primary">
                          {completed} / {total}
                        </span>
                        <span className="text-sm text-brand-textSecondary">
                          {calculateProgress(completed, total)}%
                        </span>
                      </div>
                      <Progress
                        value={completed}
                        max={total}
                        variant={completed === total ? 'success' : 'default'}
                      />
                      {technicalSection?.topic && (
                        <p className="mt-2 text-sm text-brand-textSecondary">
                          Topic: {technicalSection.topic}
                        </p>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* System Design */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  System Design
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const sdSection = session.sections?.find(s => s.type === 'system_design');
                  const completed = sdSection?.completedQuestions || 0;
                  const total = sdSection?.totalQuestions || 0;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-semibold text-brand-primary">
                          {completed} / {total}
                        </span>
                        <span className="text-sm text-brand-textSecondary">
                          {calculateProgress(completed, total)}%
                        </span>
                      </div>
                      <Progress
                        value={completed}
                        max={total}
                        variant={completed === total ? 'success' : 'default'}
                      />
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Coding */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Coding
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const codingSection = session.sections?.find(s => s.type === 'coding');
                  const completed = codingSection?.completedQuestions || 0;
                  const total = codingSection?.totalQuestions || 0;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-semibold text-brand-primary">
                          {completed} / {total}
                        </span>
                        <span className="text-sm text-brand-textSecondary">
                          {calculateProgress(completed, total)}%
                        </span>
                      </div>
                      <Progress
                        value={completed}
                        max={total}
                        variant={completed === total ? 'success' : 'default'}
                      />
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Project Interview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Project Interview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const projectSection = session.sections?.find(s => s.type === 'project');
                  const completed = projectSection?.completedQuestions || 0;
                  const total = projectSection?.totalQuestions || 0;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-semibold text-brand-primary">
                          {completed} / {total}
                        </span>
                        <span className="text-sm text-brand-textSecondary">
                          {calculateProgress(completed, total)}%
                        </span>
                      </div>
                      <Progress
                        value={completed}
                        max={total}
                        variant={completed === total ? 'success' : 'default'}
                      />
                      {projectSection?.title && (
                        <p className="mt-2 text-sm text-brand-textSecondary line-clamp-2">
                          {projectSection.title}
                        </p>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        </div>

        <div className="mb-4 overflow-hidden rounded-xl border border-brand-border bg-white shadow-sm">
          <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6" aria-expanded={dashboardPanels.tracker} onClick={() => togglePanel('tracker')}>
            <span><span className="block text-lg font-semibold text-brand-primary">Daily tracker</span><span className="block text-sm text-brand-textSecondary">Track your custom daily targets</span></span>
            <span className="shrink-0 text-xl text-brand-textSecondary" aria-hidden="true">{dashboardPanels.tracker ? '−' : '+'}</span>
          </button>
        </div>
        <div hidden={!dashboardPanels.tracker} className="min-w-0"><TrackerSection /></div>

        <div className="mb-4 overflow-hidden rounded-xl border border-brand-border bg-white shadow-sm">
          <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6" aria-expanded={dashboardPanels.planner} onClick={() => togglePanel('planner')}>
            <span><span className="block text-lg font-semibold text-brand-primary">Monthly planner</span><span className="block text-sm text-brand-textSecondary">Review and manage weekly goals</span></span>
            <span className="shrink-0 text-xl text-brand-textSecondary" aria-hidden="true">{dashboardPanels.planner ? '−' : '+'}</span>
          </button>
        </div>
        <div hidden={!dashboardPanels.planner} className="min-w-0"><PlannerSection /></div>

        {/* Session Sections */}
        {(session?.sections?.length ?? 0) > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-brand-primary mb-4">Today&apos;s Sections</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {(session?.sections ?? []).map((section) => {
                const isExpanded = !!expandedSections[section.id];
                const visibleQuestions = isExpanded ? section.questions : section.questions.slice(0, 3);
                return (
                <Card key={section.id} className={cn(
                  'card-hover',
                  section.status === 'completed' && 'border-emerald-200',
                  section.status === 'in_progress' && 'border-brand-secondary'
                )}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <button
                          type="button"
                          className="text-left text-lg font-semibold text-brand-primary hover:text-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary rounded"
                          aria-expanded={isExpanded}
                          aria-controls={`section-questions-${section.id}`}
                          onClick={() => setExpandedSections((current) => ({ ...current, [section.id]: !current[section.id] }))}
                        >
                          {section.title}
                        </button>
                        {section.description && (
                          <p className="text-sm text-brand-textSecondary">{section.description}</p>
                        )}
                      </div>
                      <Badge variant={
                        section.status === 'completed' ? 'success' :
                        section.status === 'in_progress' ? 'primary' : 'neutral'
                      }>
                        {section.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-brand-textSecondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-brand-primary">{section.completedQuestions}</span>
                        <span className="text-sm text-brand-textSecondary">/ {section.totalQuestions}</span>
                      </div>
                      {section.topic && (
                        <span className="text-sm text-brand-textSecondary">
                          {section.topic}
                        </span>
                      )}
                    </div>

                    <Progress
                      value={section.completedQuestions}
                      max={section.totalQuestions}
                      variant={section.status === 'completed' ? 'success' : 'default'}
                    />

                    {section.questions && section.questions.length > 0 && (
                      <div id={`section-questions-${section.id}`} className="mt-4 space-y-2">
                        {visibleQuestions.map((question) => (
                          <button
                            type="button"
                            key={question.id}
                            className="w-full flex items-center justify-between gap-3 py-2 border-b border-brand-border last:border-0 text-left hover:bg-brand-background/70 rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary"
                            onClick={() => router.push(`/sessions/today?questionId=${encodeURIComponent(question.id)}`)}
                            aria-label={`Open question: ${question.question}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn(
                                'w-2 h-2 rounded-full',
                                question.status === 'answered' ? 'bg-emerald-500' :
                                question.status === 'pending' ? 'bg-brand-border' :
                                'bg-amber-500'
                              )} />
                              <span className="text-sm text-brand-text truncate">
                                {truncate(question.question, 60)}
                              </span>
                            </div>
                            {question.finalScore !== undefined && (
                              <span className="text-sm font-medium text-brand-primary">
                                {Math.round(question.finalScore * 100)}%
                              </span>
                            )}
                          </button>
                        ))}
                        {section.questions.length > 3 && (
                          <button
                            type="button"
                            className="w-full text-sm text-brand-textSecondary text-center pt-2 hover:text-brand-secondary"
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedSections((current) => ({ ...current, [section.id]: !current[section.id] }))}
                          >
                            {isExpanded ? 'Show fewer questions' : `+${section.questions.length - 3} more questions`}
                          </button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );})}
            </div>
          </div>
        )}

        {/* Topic Rationale */}
        {session?.topicSelectionRationale && (
          <Card className="mb-8 bg-brand-secondary/5 border-brand-secondary/20">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-brand-primary mb-3">
                Why this topic today?
              </h3>
              <div className="flex flex-wrap gap-4 text-sm">
                {session.topicSelectionRationale.resumeRelevance && (
                  <Badge variant="primary">Resume relevance</Badge>
                )}
                {session.topicSelectionRationale.weakArea && (
                  <Badge variant="warning">Weak area detected</Badge>
                )}
                {session.topicSelectionRationale.marketRelevance && (
                  <Badge variant="neutral">Market relevance</Badge>
                )}
                {session.topicSelectionRationale.coverageGap && (
                  <Badge variant="success">Coverage gap</Badge>
                )}
              </div>
              <p className="mt-3 text-brand-textSecondary">
                {session.topicSelectionRationale.reason}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
