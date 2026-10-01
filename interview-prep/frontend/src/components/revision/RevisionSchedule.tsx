'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface RevisionEntry {
  revisionId: string;
  questionId: string;
  question: string;
  topic: string;
  subtopic: string;
  concepts: string[];
  difficulty: string;
  revisionNumber: number;
  originalScore?: number;
  dueDate: string;
  referenceAnswer: string;
}

interface ScheduleData {
  dueNow: RevisionEntry[];
  in7Days: RevisionEntry[];
  in14Days: RevisionEntry[];
  in30Days: RevisionEntry[];
  totals: { dueNow: number; in7Days: number; in14Days: number; in30Days: number };
}

const BUCKETS: Array<{ key: 'dueNow' | 'in7Days' | 'in14Days' | 'in30Days'; label: string; hint: string; accent: string }> = [
  { key: 'dueNow', label: 'Due today', hint: 'Yesterday’s weak answers (+1 day pass)', accent: 'text-rose-600' },
  { key: 'in7Days', label: 'In 7 days', hint: 'Scheduled +7-day pass', accent: 'text-amber-600' },
  { key: 'in14Days', label: 'In 14 days', hint: 'Scheduled +14-day pass', accent: 'text-blue-600' },
  { key: 'in30Days', label: 'In 30 days', hint: 'Final +30-day pass before mastery', accent: 'text-emerald-600' },
];

export function RevisionSchedule() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [failed, setFailed] = useState(false);
  const [openBucket, setOpenBucket] = useState<string | null>('dueNow');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get('/revisions/schedule')
      .then((res) => setSchedule(res.data.data))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!schedule) {
    return (
      <div className="mb-8">
        <div className="h-5 w-48 rounded bg-brand-border/40 animate-pulse mb-3" />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-brand-border/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const total = schedule.totals.dueNow + schedule.totals.in7Days + schedule.totals.in14Days + schedule.totals.in30Days;
  if (total === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-brand-primary mb-2">Revision plan</h2>
        <Card><CardContent className="p-5 text-sm text-brand-textSecondary">
          No spaced revisions scheduled yet. Answers scoring below 70% are automatically scheduled for +1, +7, +14 and +30 day passes.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-brand-primary">Revision plan</h2>
        <span className="text-xs text-brand-textSecondary">{total} question{total === 1 ? '' : 's'} scheduled</span>
      </div>
      <p className="text-sm text-brand-textSecondary mb-3">
        Weak answers resurface on a spaced schedule: +1, +7, +14 and +30 days. Reveal the model answer to check yourself.
      </p>

      {/* Bucket summary — 4-up on desktop, 2-up on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {BUCKETS.map((b) => {
          const count = schedule.totals[b.key];
          const isActive = openBucket === b.key;
          return (
            <button
              key={b.key}
              onClick={() => setOpenBucket(isActive ? null : b.key)}
              disabled={count === 0}
              className={cn(
                'text-left rounded-lg border p-3 transition-colors',
                isActive ? 'border-brand-secondary bg-brand-secondary/5' : 'border-brand-border bg-white',
                count === 0 && 'opacity-50 cursor-default'
              )}
            >
              <p className={cn('text-xs font-medium', b.accent)}>{b.label}</p>
              <p className="text-2xl font-bold text-brand-primary leading-tight">{count}</p>
              <p className="text-[11px] text-brand-textSecondary leading-snug hidden sm:block">{b.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Expanded bucket: question list with reveal-answer */}
      {openBucket && (schedule[openBucket as keyof ScheduleData] as RevisionEntry[])?.length > 0 && (
        <div className="space-y-3">
          {(schedule[openBucket as keyof ScheduleData] as RevisionEntry[]).map((entry) => (
            <Card key={entry.revisionId}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant={entry.difficulty === 'EASY' ? 'success' : entry.difficulty === 'HARD' || entry.difficulty === 'EXPERT' ? 'warning' : 'primary'}>
                    {entry.difficulty}
                  </Badge>
                  {entry.topic && <Badge variant="neutral">{entry.topic}</Badge>}
                  {entry.originalScore !== undefined && entry.originalScore !== null && (
                    <Badge variant="neutral">first score {Math.round(entry.originalScore * 100)}%</Badge>
                  )}
                  <span className="text-xs text-brand-textSecondary">
                    pass #{(entry.revisionNumber ?? 0) + 1} · due {new Date(entry.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-brand-text leading-relaxed mb-3">{entry.question}</p>

                {!revealed[entry.revisionId] ? (
                  <button
                    onClick={() => setRevealed((prev) => ({ ...prev, [entry.revisionId]: true }))}
                    className="text-sm font-medium text-brand-secondary hover:underline"
                  >
                    Show reference answer
                  </button>
                ) : (
                  <div className="rounded-lg border border-brand-border bg-brand-background p-4">
                    <h4 className="text-xs font-semibold text-brand-primary uppercase tracking-wide mb-2">Reference answer</h4>
                    <p className="text-sm leading-7 text-brand-text whitespace-pre-wrap">{entry.referenceAnswer || 'No reference answer stored for this question yet.'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
