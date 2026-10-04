'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api, { ApiResponse } from '@/lib/api';
import { CalendarMonthOverview, DailyRecord, DailyRecordEntry } from '@/types';

const TYPE_META: Record<string, { label: string; color: string }> = {
  technical: { label: 'Technical', color: 'bg-brand-secondary' },
  system_design: { label: 'System Design', color: 'bg-pink-500' },
  coding: { label: 'Coding', color: 'bg-cyan-500' },
  project: { label: 'Project', color: 'bg-indigo-500' },
  revision: { label: 'Revision', color: 'bg-amber-500' },
  mock_interview: { label: 'Mock', color: 'bg-purple-500' },
  behavioral: { label: 'Behavioral', color: 'bg-rose-500' },
  search: { label: 'Web Search', color: 'bg-emerald-500' },
  custom: { label: 'Other', color: 'bg-gray-400' },
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { isAuthenticated } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  });
  const [overview, setOverview] = useState<CalendarMonthOverview | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayRecord, setDayRecord] = useState<DailyRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    api
      .get<ApiResponse<CalendarMonthOverview>>(`/calendar/month/${cursor.year}/${cursor.month}`)
      .then((res) => setOverview(res.data.data || null))
      .catch(() => setError('Failed to load calendar'))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, cursor]);

  useEffect(() => {
    if (!selectedDate) return;
    setIsLoadingDay(true);
    api
      .get<ApiResponse<DailyRecord>>(`/calendar/day/${selectedDate}`)
      .then((res) => setDayRecord(res.data.data || null))
      .catch(() => setDayRecord(null))
      .finally(() => setIsLoadingDay(false));
  }, [selectedDate]);

  // Build a 6x7 grid of UTC dates for the cursor month
  const grid = useMemo(() => {
    const { year, month } = cursor;
    const first = new Date(Date.UTC(year, month - 1, 1));
    const startOffset = (first.getUTCDay() + 6) % 7; // Monday-first
    const cells: Array<{ dateKey: string; dayOfMonth: number; inMonth: boolean }> = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(first);
      d.setUTCDate(1 - startOffset + i);
      cells.push({
        dateKey: utcDateKey(d),
        dayOfMonth: d.getUTCDate(),
        inMonth: d.getUTCMonth() === month - 1,
      });
    }
    return cells;
  }, [cursor]);

  const dayMap = useMemo(() => {
    const m = new Map<string, CalendarMonthOverview['days'][number]>();
    for (const day of overview?.days || []) m.set(day.date, day);
    return m;
  }, [overview]);

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month - 1 + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    });
  };

  const monthLabel = new Date(Date.UTC(cursor.year, cursor.month - 1, 1)).toLocaleDateString(
    'en-US',
    { month: 'long', year: 'numeric', timeZone: 'UTC' }
  );

  return (
    <div className="min-h-screen bg-brand-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-brand-primary">Preparation Calendar</h1>
        <p className="mt-2 text-brand-textSecondary">
          A day-by-day record of every interview, system design, coding and project question —
          plus your web searches.
        </p>

        {error && <p className="mt-4 text-red-500">{error}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          {/* Month grid */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => shiftMonth(-1)}
                    className="px-3 py-1.5 rounded-lg border border-brand-border text-sm hover:bg-brand-primary/5"
                  >
                    ← Prev
                  </button>
                  <h2 className="text-lg font-semibold text-brand-primary">{monthLabel}</h2>
                  <button
                    onClick={() => shiftMonth(1)}
                    className="px-3 py-1.5 rounded-lg border border-brand-border text-sm hover:bg-brand-primary/5"
                  >
                    Next →
                  </button>
                </div>

                {isLoading ? (
                  <div className="py-16 flex justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-secondary" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {WEEKDAYS.map((w) => (
                        <div key={w} className="text-center text-xs font-medium text-brand-textSecondary py-1">
                          {w}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {grid.map((cell) => {
                        const day = dayMap.get(cell.dateKey);
                        const totals = day?.totals;
                        return (
                          <button
                            key={cell.dateKey}
                            onClick={() => setSelectedDate(cell.dateKey)}
                            className={`aspect-square rounded-lg border p-1 text-left transition-colors ${
                              cell.inMonth ? 'bg-white' : 'bg-gray-50 opacity-50'
                            } ${
                              selectedDate === cell.dateKey
                                ? 'border-brand-secondary ring-1 ring-brand-secondary'
                                : 'border-brand-border hover:border-brand-secondary/50'
                            }`}
                          >
                            <span className="text-xs text-brand-text">{cell.dayOfMonth}</span>
                            {day && (
                              <div className="mt-1 flex flex-col gap-0.5">
                                <span className="text-[10px] leading-none text-brand-textSecondary">
                                  {totals?.questions || 0}q
                                  {(totals?.searches || 0) > 0 ? ` · ${totals?.searches ?? 0}s` : ''}
                                </span>
                                <div className="flex gap-0.5 flex-wrap">
                                  {Object.entries(totals?.byType || {}).map(([type, count]) => (
                                    <span
                                      key={type}
                                      title={`${TYPE_META[type]?.label || type}: ${count}`}
                                      className={`w-1.5 h-1.5 rounded-full ${TYPE_META[type]?.color || 'bg-gray-400'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Day detail */}
          <div className="lg:col-span-2">
            <Card className="lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle>
                  {selectedDate
                    ? new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })
                    : 'Select a day'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingDay ? (
                  <div className="py-10 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-secondary" />
                  </div>
                ) : !selectedDate ? (
                  <p className="text-sm text-brand-textSecondary">
                    Click a calendar day to see every question asked and search performed on that
                    date.
                  </p>
                ) : !dayRecord ? (
                  <p className="text-sm text-brand-textSecondary">
                    No activity recorded on this day.
                  </p>
                ) : (
                  <>
                    {/* Day totals */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="rounded-lg bg-brand-secondary/5 p-3">
                        <p className="text-xs text-brand-textSecondary">Questions</p>
                        <p className="text-lg font-semibold text-brand-primary">
                          {dayRecord.totals.questions}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-3">
                        <p className="text-xs text-brand-textSecondary">Answered</p>
                        <p className="text-lg font-semibold text-brand-primary">
                          {dayRecord.totals.answered}
                        </p>
                      </div>
                      <div className="rounded-lg bg-amber-50 p-3">
                        <p className="text-xs text-brand-textSecondary">Web searches</p>
                        <p className="text-lg font-semibold text-brand-primary">
                          {dayRecord.totals.searches}
                        </p>
                      </div>
                      <div className="rounded-lg bg-brand-primary/5 p-3">
                        <p className="text-xs text-brand-textSecondary">Avg score</p>
                        <p className="text-lg font-semibold text-brand-primary">
                          {dayRecord.averageScore !== undefined && dayRecord.averageScore !== null
                            ? `${Math.round(dayRecord.averageScore * 100)}%`
                            : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Entries */}
                    <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                      {dayRecord.entries.map((entry, index) => (
                        <EntryRow
                          key={
                            entry.id ||
                            `${dayRecord.dateKey}:${entry.metadata?.questionId || entry.type}:${entry.title}:${index}`
                          }
                          entry={entry}
                        />
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryRow({ entry }: { entry: DailyRecordEntry }) {
  const meta = TYPE_META[entry.type] || TYPE_META.custom;
  const questionId = entry.metadata?.questionId;
  const [answer, setAnswer] = useState<CalendarAnswer | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnswer = async (regenerate: boolean) => {
    if (!questionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = regenerate
        ? await api.post(`/sessions/question/${questionId}/generate-answer`).catch(() =>
            api.get(`/sessions/question/${questionId}/answer`, { params: { regenerate: 1 } })
          )
        : await api.get(`/sessions/question/${questionId}/answer`);
      setAnswer(res.data.data || null);
      setShowAnswer(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not load the answer. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-start gap-2 py-2 border-b border-brand-border last:border-0">
      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${meta.color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-brand-text">
          {entry.type === 'search' && entry.sourceUrls?.[0] ? (
            <a
              href={entry.sourceUrls[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {entry.title}
            </a>
          ) : (
            entry.title
          )}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-brand-textSecondary">
            {meta.label}
          </span>
          {entry.topic && entry.topic !== entry.title && (
            <span className="text-[10px] text-brand-textSecondary">{entry.topic}</span>
          )}
          {entry.difficulty && (
            <Badge variant="neutral">{entry.difficulty.toLowerCase()}</Badge>
          )}
          {entry.status === 'answered' || entry.status === 'completed' ? (
            <Badge variant="success">answered</Badge>
          ) : entry.status === 'skipped' ? (
            <Badge variant="warning">skipped</Badge>
          ) : (
            <Badge variant="neutral">{entry.status}</Badge>
          )}
          {entry.score !== undefined && entry.score !== null && (
            <span className="text-[10px] font-medium text-brand-primary">
              {Math.round(entry.score * 100)}%
            </span>
          )}
        </div>

        {/* Show / generate the interview answer for this question. */}
        {entry.type !== 'search' && questionId && (
          <div className="mt-2">
            {!showAnswer ? (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" isLoading={loading} onClick={() => loadAnswer(false)}>
                  Show answer
                </Button>
                <Button size="sm" variant="ghost" isLoading={loading} onClick={() => loadAnswer(true)}>
                  Generate answer
                </Button>
              </div>
            ) : (
              <AnswerBody answer={answer} />
            )}
            {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

interface CalendarAnswer {
  sections?: {
    direct: string;
    questionFocus: string;
    why: string;
    how: string;
    example: string;
    tradeOff: string;
    summary: string;
  };
  legacyAnswer?: string;
  detailed?: {
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
  };
  description?: string;
  starterCode?: string;
}

function AnswerBody({ answer }: { answer: CalendarAnswer | null }) {
  if (!answer) {
    return <p className="mt-2 text-xs text-brand-textSecondary">No answer available yet.</p>;
  }
  return (
    <div className="mt-2 rounded-lg border border-brand-border bg-brand-background p-3">
      {answer.sections ? (
        <div className="space-y-2">
          <AnswerPart label="Direct answer" body={answer.sections.direct} />
          <AnswerPart label="Why" body={answer.sections.why} />
          <AnswerPart label="How" body={answer.sections.how} />
          <AnswerPart label="Example" body={answer.sections.example} />
          <AnswerPart label="Trade-off" body={answer.sections.tradeOff} />
          <AnswerPart label="Summary" body={answer.sections.summary} />
        </div>
      ) : (
        <p className="text-sm leading-6 text-brand-text whitespace-pre-wrap">{answer.legacyAnswer}</p>
      )}
      {answer.detailed && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-brand-secondary">
            Detailed study guide
          </summary>
          <div className="mt-2 space-y-2">
            <AnswerPart label="Overview" body={answer.detailed.overview} />
            <div>
              <h5 className="text-xs font-semibold text-brand-primary">Key points</h5>
              <ul className="list-disc list-inside text-xs text-brand-text mt-1 space-y-1">
                {answer.detailed.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </div>
            <AnswerPart label="Algorithm / approach" body={answer.detailed.algorithmOrApproach} />
            {answer.detailed.codeSketch && (
              <pre className="text-[11px] leading-5 font-mono bg-white rounded p-2 overflow-x-auto border border-brand-border">
                {answer.detailed.codeSketch}
              </pre>
            )}
            <AnswerPart label="Complexity / trade-offs" body={answer.detailed.complexity} />
            <div>
              <h5 className="text-xs font-semibold text-brand-primary">Edge cases</h5>
              <ul className="list-disc list-inside text-xs text-brand-text mt-1 space-y-1">
                {answer.detailed.edgeCases.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-brand-primary">Common mistakes</h5>
              <ul className="list-disc list-inside text-xs text-brand-text mt-1 space-y-1">
                {answer.detailed.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
            <AnswerPart label="Why it matters" body={answer.detailed.whyItMatters} />
          </div>
        </details>
      )}
    </div>
  );
}

function AnswerPart({ label, body }: { label: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <h5 className="text-xs font-semibold text-brand-primary">{label}</h5>
      <p className="text-xs leading-5 text-brand-text whitespace-pre-wrap mt-0.5">{body}</p>
    </div>
  );
}
