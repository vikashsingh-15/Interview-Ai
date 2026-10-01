'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface BankQuestion {
  _id: string;
  question: string;
  topic: string;
  subtopic: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  questionType: string;
  archetype: string;
  concepts: string[];
  estimatedAnswerTimeSeconds: number;
}

const DIFFICULTY_ORDER: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2, EXPERT: 3 };

export default function TopicsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<BankQuestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    api.get('/questions', { params: { limit: 100 } })
      .then((res) => setQuestions(res.data.data ?? []))
      .catch(() => setFailed(true));
  }, [authLoading, isAuthenticated]);

  const topics = useCallback(() => {
    const byTopic = new Map<string, BankQuestion[]>();
    for (const q of questions ?? []) {
      const list = byTopic.get(q.topic) ?? [];
      list.push(q);
      byTopic.set(q.topic, list);
    }
    return [...byTopic.entries()]
      .map(([name, list]) => {
        const counts = { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 };
        for (const q of list) counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1;
        const masteryBase = list.length * 3 - counts.EASY - counts.MEDIUM * 0.5; // rough emphasis on depth
        return {
          name,
          total: list.length,
          counts,
          concepts: [...new Set(list.flatMap((q) => q.concepts))].slice(0, 6),
          subtopics: [...new Set(list.map((q) => q.subtopic))],
          depth: list.length ? Math.max(0, Math.min(100, Math.round((masteryBase / (list.length * 3)) * 100))) : 0,
        };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [questions]);

  const topicList = topics();
  const active = topicList.find((t) => t.name === activeTopic) ?? null;
  const activeQuestions = (questions ?? [])
    .filter((q) => q.topic === activeTopic)
    .sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 9) - (DIFFICULTY_ORDER[b.difficulty] ?? 9));

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-background">
        {authLoading ? (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary" />
        ) : (
          <Card className="max-w-md"><CardContent className="p-8 text-center">
            <p className="text-brand-textSecondary">Sign in to browse your question bank.</p>
            <Link href="/login" className="mt-4 inline-block text-brand-secondary hover:underline">Sign in</Link>
          </CardContent></Card>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-background py-8 px-4">
      <div className="mx-auto max-w-6xl">
        {active ? (
          <>
            <button onClick={() => setActiveTopic(null)} className="text-sm text-brand-secondary hover:underline mb-4">
              ← All topics
            </button>
            <h1 className="text-2xl font-bold text-brand-primary mb-1">{active.name}</h1>
            <p className="text-brand-textSecondary mb-6">
              {active.total} question{active.total === 1 ? '' : 's'} across {active.subtopics.length} subtopic{active.subtopics.length === 1 ? '' : 's'}
            </p>
            <div className="space-y-3">
              {activeQuestions.map((q) => (
                <Card key={q._id}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant={q.difficulty === 'EASY' ? 'success' : q.difficulty === 'HARD' || q.difficulty === 'EXPERT' ? 'warning' : 'primary'}>
                        {q.difficulty}
                      </Badge>
                      <Badge variant="neutral">{q.questionType}</Badge>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-brand-primary mb-1">Question bank topics</h1>
            <p className="text-brand-textSecondary mb-6">
              Approved questions available for your sessions, grouped by topic. Pick one to see its questions.
            </p>
            {failed && (
              <Card className="mb-6"><CardContent className="p-5 text-sm text-red-600">
                Could not load the question bank. Check that the backend is running, then refresh.
              </CardContent></Card>
            )}
            {!questions && !failed && (
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
            {questions && topicList.length === 0 && (
              <Card><CardContent className="p-10 text-center text-brand-textSecondary">
                No approved questions yet. Generate a daily session or run the seed script to fill the bank.
              </CardContent></Card>
            )}
            {topicList.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {topicList.map((t) => (
                  <button key={t.name} onClick={() => setActiveTopic(t.name)} className="text-left">
                    <Card className={cn('card-hover h-full transition-shadow')}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="truncate">{t.name}</span>
                          <Badge variant="primary">{t.total}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-3 mb-3 text-xs text-brand-textSecondary">
                          <span>{t.counts.EASY} easy</span>
                          <span>{t.counts.MEDIUM} medium</span>
                          <span>{t.counts.HARD} hard</span>
                          <span>{t.counts.EXPERT} expert</span>
                        </div>
                        <Progress value={t.depth} max={100} className="mb-3" />
                        <div className="flex flex-wrap gap-1.5">
                          {t.concepts.map((c) => (
                            <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-brand-background text-brand-textSecondary truncate max-w-[140px]">{c}</span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
