'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api, { ApiResponse } from '@/lib/api';
import { UserPreferences } from '@/types';

const DIFFICULTY_OPTIONS: Array<{
  value: 'easy' | 'medium' | 'hard' | 'extra_hard' | 'mixed';
  label: string;
  description: string;
  color: string;
}> = [
  {
    value: 'easy',
    label: 'Easy',
    description: 'Fundamentals and warm-up questions only',
    color: 'bg-emerald-500',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Standard interview level — the common default',
    color: 'bg-blue-500',
  },
  {
    value: 'hard',
    label: 'Hard',
    description: 'Deep dives, trade-offs and production scenarios',
    color: 'bg-amber-500',
  },
  {
    value: 'extra_hard',
    label: 'Extra Hard',
    description: 'Expert level — system internals and extreme scale',
    color: 'bg-rose-500',
  },
  {
    value: 'mixed',
    label: 'Mixed (default)',
    description: 'A blend: 20% easy, 50% medium, 20% hard, 10% expert',
    color: 'bg-brand-secondary',
  },
];

const COUNT_FIELDS: Array<{
  key: keyof Pick<
    UserPreferences,
    'dailyQuestions' | 'codingCount' | 'systemDesignCount' | 'projectQuestions'
  >;
  label: string;
  description: string;
  min: number;
  max: number;
}> = [
  {
    key: 'dailyQuestions',
    label: 'Technical / interview questions per day',
    description: 'Core concept questions on your chosen topic',
    min: 1,
    max: 50,
  },
  {
    key: 'codingCount',
    label: 'Coding / DSA problems per day',
    description: 'Hands-on problems in your preferred patterns',
    min: 1,
    max: 10,
  },
  {
    key: 'systemDesignCount',
    label: 'System design questions per day',
    description: 'HLD/LLD and distributed systems design',
    min: 1,
    max: 10,
  },
  {
    key: 'projectQuestions',
    label: 'Project interview questions per day',
    description: 'Deep dives into your resume projects',
    min: 3,
    max: 10,
  },
];

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get<ApiResponse<{ preferences: UserPreferences }>>('/profile/preferences')
      .then((res) => setPrefs(res.data.data?.preferences || null))
      .catch(() => setError('Failed to load preferences'))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const setDifficulty = (difficulty: string) => {
    if (!prefs) return;
    setPrefs({ ...prefs, difficulty } as UserPreferences);
  };

  const setCount = (key: string, value: number) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value } as UserPreferences);
  };

  const save = async () => {
    if (!prefs) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: Record<string, any> = {
        difficulty: prefs.difficulty,
      };
      for (const { key, min, max } of COUNT_FIELDS) {
        const raw = (prefs as any)[key];
        const num = Number(raw);
        if (Number.isInteger(num)) {
          payload[key] = Math.min(Math.max(num, min), max);
        }
      }

      const res = await api.put<ApiResponse<{ preferences: UserPreferences }>>(
        '/profile/preferences',
        payload
      );
      setPrefs(res.data.data?.preferences || prefs);
      setMessage('Saved! Your next generated session will use these settings.');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary" />
      </div>
    );
  }

  const activeDifficulty = prefs?.difficulty || 'mixed';

  return (
    <div className="min-h-screen bg-brand-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-brand-primary">Session Settings</h1>
        <p className="mt-2 text-brand-textSecondary">
          Choose how many questions you get each day and how hard they should be.
        </p>

        {message && (
          <Card className="mt-6 border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <p className="text-emerald-700 text-sm">{message}</p>
            </CardContent>
          </Card>
        )}
        {error && (
          <Card className="mt-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Difficulty */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Difficulty</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-brand-textSecondary mb-4">
              All questions in your sessions will match this difficulty. Applies to
              technical, coding and system design questions.
            </p>
            <div className="space-y-2">
              {DIFFICULTY_OPTIONS.map((option) => {
                const selected = activeDifficulty === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setDifficulty(option.value)}
                    className={`w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                      selected
                        ? 'border-brand-secondary bg-brand-secondary/5 ring-1 ring-brand-secondary'
                        : 'border-brand-border bg-white hover:border-brand-secondary/50'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${option.color}`} />
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-brand-primary">{option.label}</span>
                        {selected && <Badge variant="primary">selected</Badge>}
                      </span>
                      <span className="block text-sm text-brand-textSecondary">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Question counts */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Questions per day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {COUNT_FIELDS.map(({ key, label, description, min, max }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-brand-text" htmlFor={`pref-${key}`}>
                      {label}
                    </label>
                    <span className="text-lg font-bold text-brand-secondary w-10 text-right">
                      {(prefs as any)?.[key] ?? '—'}
                    </span>
                  </div>
                  <p className="text-xs text-brand-textSecondary mb-2">{description}</p>
                  <input
                    id={`pref-${key}`}
                    type="range"
                    min={min}
                    max={max}
                    value={(prefs as any)?.[key] ?? min}
                    onChange={(e) => setCount(key, Number(e.target.value))}
                    className="w-full accent-brand-secondary"
                  />
                  <div className="flex justify-between text-xs text-brand-textSecondary">
                    <span>{min}</span>
                    <span>{max}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={isSaving || !prefs}>
            {isSaving ? 'Saving…' : 'Save preferences'}
          </Button>
        </div>
      </div>
    </div>
  );
}
