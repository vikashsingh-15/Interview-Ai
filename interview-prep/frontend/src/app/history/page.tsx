'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import api, { ApiResponse } from '@/lib/api';
import { PastQuestionDay } from '@/types';
import { AnswerView, RevealedAnswer } from '@/components/features/AnswerView';
import { TrackerHistory } from '@/components/tracker/TrackerHistory';
import { PlannerHistory } from '@/components/planner/PlannerHistory';
import { InterviewCalendar } from '@/components/calendar/InterviewCalendar';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  technical: { label: 'Technical', color: 'bg-brand-secondary' },
  system_design: { label: 'System Design', color: 'bg-pink-500' },
  coding: { label: 'Coding', color: 'bg-cyan-500' },
  project: { label: 'Project', color: 'bg-indigo-500' },
  revision: { label: 'Revision', color: 'bg-amber-500' },
  mock_interview: { label: 'Mock', color: 'bg-purple-500' },
  behavioral: { label: 'Behavioral', color: 'bg-rose-500' },
  custom: { label: 'Other', color: 'bg-gray-400' },
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-brand-secondary';
  if (score >= 40) return 'text-amber-600';
  return 'text-rose-600';
}

function formatDateKey(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function HistoryPage() {
  const { isAuthenticated } = useAuth();
  const [days, setDays] = useState<PastQuestionDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, RevealedAnswer>>({});
  const [answerLoading, setAnswerLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'interview' | 'tracker' | 'planner'>('interview');
  const [tabInitialized, setTabInitialized] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiResponse<{ days: PastQuestionDay[] }>>(
        '/profile/past-questions?limit=30'
      );
      setDays(res.data.data?.days || []);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tabInitialized && isAuthenticated && activeTab === 'interview') {
      load();
    }
  }, [isAuthenticated, load, activeTab, tabInitialized]);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'tracker' || tab === 'planner') {
      setActiveTab(tab);
      setIsLoading(false);
    }
    setTabInitialized(true);
  }, []);

  const revealAnswer = async (questionId: string, regenerate: boolean) => {
    if (answerLoading) return;
    setAnswerLoading(questionId);
    setError(null);
    try {
      const res = regenerate
        ? await api.post(`/sessions/question/${questionId}/generate-answer`)
        : await api.get(`/sessions/question/${questionId}/answer`);
      setAnswers((prev) => ({ ...prev, [questionId]: res.data.data }));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not load the answer. Try again.');
    } finally {
      setAnswerLoading(null);
    }
  };

  const markKnown = async (entryId: string, title: string, date: string) => {
    try {
      await api.post('/profile/past-questions/mark-known', { title, date });
      setMarkedIds((prev) => new Set(prev).add(entryId));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to mark question');
    }
  };

  const totals = days.reduce(
    (acc, d) => ({
      questions: acc.questions + d.questions,
      answered: acc.answered + d.answered,
    }),
    { questions: 0, answered: 0 }
  );
  const overallPerformance =
    days.length > 0
      ? Math.round(days.reduce((sum, d) => sum + d.performanceScore, 0) / days.length)
      : 0;

  return (
    <div className="min-h-screen bg-brand-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-brand-primary">History</h1>
        <p className="mt-2 text-brand-textSecondary">Review your interview practice, daily tracker progress, and monthly planner goals.</p>

        <div role="tablist" aria-label="History type" className="mt-6 flex flex-wrap gap-2 border-b border-brand-border">
          {(['interview', 'tracker', 'planner'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`border-b-2 px-4 py-3 text-sm font-medium capitalize ${activeTab === tab ? 'border-brand-secondary text-brand-secondary' : 'border-transparent text-brand-textSecondary hover:text-brand-primary'}`}>{tab}</button>)}
        </div>

        {activeTab === 'tracker' && <div className="mt-6"><TrackerHistory /></div>}
        {activeTab === 'planner' && <div className="mt-6"><PlannerHistory /></div>}

        {activeTab === 'interview' && <>

        <div className="mt-6">
          <InterviewCalendar />
        </div>

        {error && (
          <Card className="mt-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        {!isLoading && days.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-brand-primary">{days.length}</p>
                <p className="text-xs text-brand-textSecondary">active days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-brand-primary">{totals.questions}</p>
                <p className="text-xs text-brand-textSecondary">questions asked</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${scoreColor(overallPerformance)}`}>
                  {overallPerformance}%
                </p>
                <p className="text-xs text-brand-textSecondary">avg performance</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <Card className="mt-8">
            <CardContent className="p-10 flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-secondary" />
            </CardContent>
          </Card>
        )}

        {/* Empty */}
        {!isLoading && days.length === 0 && (
          <Card className="mt-8">
            <CardContent className="p-10 text-center">
              <p className="text-brand-textSecondary">
                No questions yet. Generate your first daily session to start your history.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Day list */}
        <div className="mt-8 space-y-4">
          {days.map((day) => {
            const isExpanded = expandedDate === day.date;
            return (
              <Card key={day.date}>
                <CardContent className="p-0">
                  {/* Day header — clickable */}
                  <button
                    onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                    className="w-full text-left p-5 hover:bg-brand-primary/[0.03] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <h2 className="font-semibold text-brand-primary">
                          {formatDateKey(day.date)}
                        </h2>
                        <p className="text-xs text-brand-textSecondary mt-0.5">
                          {day.sessionDayNumber ? `Day ${day.sessionDayNumber} · ` : ''}
                          {day.answered}/{day.questions} answered
                          {day.known > 0 ? ` · ${day.known} already known` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 min-w-[140px]">
                        {/* Performance score */}
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${scoreColor(day.performanceScore)}`}>
                            {day.performanceScore}%
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-brand-textSecondary">
                            day score
                          </p>
                        </div>
                        <svg
                          className={`w-5 h-5 text-brand-textSecondary transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    <Progress
                      value={day.answered}
                      max={Math.max(day.questions, 1)}
                      variant={day.performanceScore >= 80 ? 'success' : 'default'}
                      className="mt-3"
                    />
                  </button>

                  {/* Expanded entries */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-brand-border pt-4 space-y-3">
                      {day.entries.map((entry) => {
                        const meta = TYPE_LABELS[entry.type] || TYPE_LABELS.custom;
                        const isMarked = entry.knewAnswer || markedIds.has(entry.id);
                        return (
                          <div
                            key={entry.id}
                            className="flex items-start gap-3 rounded-lg border border-brand-border p-3"
                          >
                            <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${meta.color}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-brand-text">{entry.title}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] uppercase tracking-wide text-brand-textSecondary">
                                  {meta.label}
                                </span>
                                {entry.difficulty && (
                                  <Badge variant="neutral">{entry.difficulty.toLowerCase()}</Badge>
                                )}
                                {isMarked ? (
                                  <Badge variant="success">✓ already knew</Badge>
                                ) : entry.status === 'answered' || entry.status === 'completed' ? (
                                  <Badge variant="success">answered</Badge>
                                ) : entry.status === 'skipped' ? (
                                  <Badge variant="warning">skipped</Badge>
                                ) : (
                                  <Badge variant="neutral">{entry.status}</Badge>
                                )}
                                {typeof entry.score === 'number' && !isMarked && (
                                  <span className="text-[10px] font-medium text-brand-primary">
                                    {Math.round(entry.score * 100)}%
                                  </span>
                                )}
                              </div>

                              {/* Show / generate this question's interview answer. */}
                              {entry.questionId && entry.type !== 'search' && (
                                <div className="mt-2">
                                  {!answers[entry.questionId] ? (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        isLoading={answerLoading === entry.questionId}
                                        onClick={() => revealAnswer(entry.questionId!, false)}
                                      >
                                        Show answer
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        isLoading={answerLoading === entry.questionId}
                                        onClick={() => revealAnswer(entry.questionId!, true)}
                                      >
                                        Generate answer
                                      </Button>
                                    </div>
                                  ) : (
                                    <AnswerView answer={answers[entry.questionId]} hint={{ difficulty: entry.difficulty }} />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Mark-done button */}
                            {!isMarked && (
                              <button
                                onClick={() => markKnown(entry.id, entry.title, day.date)}
                                className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                                title="I already knew this answer — mark as done"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                I knew this
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Load more hint */}
        {!isLoading && days.length >= 30 && (
          <p className="mt-6 text-center text-sm text-brand-textSecondary">
            Showing your 30 most recent active days.
          </p>
        )}
        </>}
      </div>
    </div>
  );
}
