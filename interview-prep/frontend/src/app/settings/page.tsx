'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api, { ApiResponse, logQuestionGenerationError } from '@/lib/api';
import { UserPreferences } from '@/types';
import { ResumeManager } from '@/components/resume/ResumeManager';
import { useTheme, ThemeMode } from '@/components/providers/ThemeProvider';

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
    description: 'A mix appropriate to your profile and the planned questions',
    color: 'bg-brand-secondary',
  },
];

interface AIStatus {
  configured: boolean;
  provider: string;
  model: string;
  hasApiKey: boolean;
  activeProvider: string | null;
  fallback: { configured: boolean; provider: string; model: string; hasApiKey: boolean };
  recentRequests?: Array<{ purpose: string; provider: string; model: string; status: string }>;
  lastSuccessful?: { provider: string; model: string; purpose: string; at: string } | null;
}

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
    min: 0,
    max: 50,
  },
  {
    key: 'codingCount',
    label: 'Coding / DSA problems per day',
    description: 'Hands-on problems in your preferred patterns',
    min: 0,
    max: 50,
  },
  {
    key: 'systemDesignCount',
    label: 'System design questions per day',
    description: 'HLD/LLD and distributed systems design',
    min: 0,
    max: 50,
  },
  {
    key: 'projectQuestions',
    label: 'Project interview questions per day',
    description: 'Deep dives into your resume projects',
    min: 0,
    max: 50,
  },
];

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get<ApiResponse<{ preferences: UserPreferences }>>('/profile/preferences')
      .then((res) => setPrefs(res.data.data?.preferences || null))
      .catch(() => setError('Failed to load preferences'))
      .finally(() => setIsLoading(false));
    // Provider diagnostics explain a failed regeneration without server logs.
    api.get<ApiResponse<AIStatus>>('/profile/ai-status')
      .then((res) => setAiStatus(res.data.data || null))
      .catch(() => setAiStatus(null));
  }, [isAuthenticated]);

  const setDifficulty = (difficulty: string) => {
    if (!prefs) return;
    setPrefs({ ...prefs, difficulty } as UserPreferences);
  };

  const setCount = (key: string, value: number) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value } as UserPreferences);
  };

  const buildPayload = (): Record<string, any> | null => {
    if (!prefs) return null;
    const payload: Record<string, any> = { difficulty: prefs.difficulty };
    for (const { key, min, max } of COUNT_FIELDS) {
      const raw = (prefs as any)[key];
      const num = Number(raw);
      if (Number.isInteger(num)) {
        payload[key] = Math.min(Math.max(num, min), max);
      }
    }
    return payload;
  };

  const save = async () => {
    if (!prefs) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.put<ApiResponse<{ preferences: UserPreferences }>>(
        '/profile/preferences',
        buildPayload()
      );
      setPrefs(res.data.data?.preferences || prefs);
      setMessage('Saved! Your next generated session will use these settings.');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const applyToToday = async () => {
    if (!prefs || isApplying) return;
    setIsApplying(true);
    setMessage(null);
    setError(null);
    try {
      await api.put('/profile/preferences', buildPayload());
      const res = await api.post('/sessions/today/regenerate');
      const total = res.data?.data?.totalQuestions ?? 0;
      setMessage(total === 0
        ? res.data?.data?.generationMessage || 'Saved, but no new questions were generated for today.'
        : `Saved — today\u2019s session now has ${total} fresh question${total === 1 ? '' : 's'}.`);
      api.get<ApiResponse<AIStatus>>('/profile/ai-status')
        .then((r) => setAiStatus(r.data.data || null))
        .catch(() => {});
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message;
      setError(msg === 'No session for today yet. Generate it first.'
        ? 'Preferences saved. Today\u2019s session will use them when it is generated.'
        : msg || 'Preferences may be saved, but regenerating today\u2019s session failed. Try again from the dashboard.');
    } finally {
      setIsApplying(false);
    }
  };

  const resetAllData = async () => {
    if (isResetting) return;
    setIsResetting(true);
    setMessage(null);
    setError(null);
    try {
      await api.post('/auth/me/reset', { confirmation: 'RESET' });
      setShowResetDialog(false);
      setResetConfirmation('');
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reset data. Try signing in again first.');
    } finally {
      setIsResetting(false);
    }
  };

  if (authLoading) return <SignInPrompt pageName="settings" returnTo="/settings" isLoading />;
  if (!isAuthenticated) return <SignInPrompt pageName="settings" returnTo="/settings" />;

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
        <a href="/api/auth/google/link" className="text-blue-700 underline">Link or re-confirm Google for this account</a>
        <p className="mt-2 text-brand-textSecondary">
          Choose how many questions you get each day and how hard they should be.
        </p>
        <Card className="mt-6 border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-300">Reset profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-800 dark:text-red-200">
              Clear your interview profile, projects, preferences, practice activity, generated and
              asked questions, answers, calendar, sessions, and progress. Uploaded resume files
              and your sign-in will stay saved so you can build a fresh profile.
            </p>
            <Button
              variant="secondary"
              onClick={() => { setError(null); setResetConfirmation(''); setShowResetDialog(true); }}
              disabled={isResetting}
              className="mt-4 border-red-300 bg-red-600 text-white hover:bg-red-700"
            >
              {isResetting ? 'Resetting…' : 'Reset profile and clear practice data'}
            </Button>
          </CardContent>
        </Card>
        <Card className="mt-6"><CardHeader><CardTitle>Appearance</CardTitle></CardHeader><CardContent><p className="mb-3 text-sm text-brand-textSecondary">Choose how Interview Prep should look on this device.</p><div className="flex flex-wrap gap-2" role="group" aria-label="Theme preference">{(['light', 'dark', 'system'] as ThemeMode[]).map(option => <button key={option} type="button" onClick={() => setTheme(option)} aria-pressed={theme === option} className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${theme === option ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary' : 'border-brand-border bg-brand-surface text-brand-text hover:bg-brand-primary/10'}`}>{option}</button>)}</div></CardContent></Card>
        <div className="mt-8 border-t border-brand-border pt-8"><ResumeManager /></div>

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

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            onClick={applyToToday}
            disabled={isApplying || isSaving || !prefs}
            title="Save now and rebuild today's session: answered and skipped questions stay, the rest are replaced with the new counts."
          >
            {isApplying ? 'Applying to today…' : 'Save and apply to today'}
          </Button>
          <Button onClick={save} disabled={isSaving || !prefs}>
            {isSaving ? 'Saving…' : 'Save preferences'}
          </Button>
        </div>

        {aiStatus && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Question generation status</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-brand-textSecondary">Configured provider</dt>
                  <dd className="font-medium text-brand-primary text-right">
                    {aiStatus.provider} / {aiStatus.model || 'no model set'}
                  </dd>
                </div>
                {aiStatus.lastSuccessful && <div className="flex justify-between gap-4 sm:col-span-2"><dt className="text-brand-textSecondary">Last successful request</dt><dd className="font-medium text-brand-primary text-right">{aiStatus.lastSuccessful.provider} / {aiStatus.lastSuccessful.model}</dd></div>}
                <div className="flex justify-between gap-4">
                  <dt className="text-brand-textSecondary">API key</dt>
                  <dd className="font-medium text-brand-primary text-right">
                    {aiStatus.hasApiKey ? 'configured' : 'missing'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-brand-textSecondary">Fallback provider</dt>
                  <dd className="font-medium text-brand-primary text-right">
                    {aiStatus.fallback.configured
                      ? `${aiStatus.fallback.provider} / ${aiStatus.fallback.model}`
                      : 'not configured'}
                  </dd>
                </div>
                {aiStatus.activeProvider && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-brand-textSecondary">Currently serving</dt>
                    <dd className="font-medium text-brand-primary text-right">{aiStatus.activeProvider}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-3 text-xs text-brand-textSecondary">
                A fallback provider takes over automatically when the primary is rate-limited,
                unreachable, or returns unusable output. Set AI_FALLBACK_PROVIDER,
                AI_FALLBACK_API_KEY and AI_FALLBACK_MODEL in the backend .env to enable one.
              </p>
            </CardContent>
          </Card>
        )}

        {showResetDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm data reset">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Reset profile and practice data?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-brand-text">
                  This permanently deletes your interview profile, parsed resume details,
                  projects, preferences, generated and asked questions, answers, history, calendar,
                  sessions, and progress. Uploaded resume files and your sign-in will be kept.
                  This cannot be undone.
                </p>
                {error && <p role="alert" className="mt-3 rounded-md bg-brand-error/10 p-3 text-sm text-brand-error">{error} <a className="font-semibold text-brand-secondary underline" href="/api/auth/google/link">Sign in with Google again</a>, then retry.</p>}
                <label className="mt-4 block text-sm font-medium text-brand-text" htmlFor="reset-confirmation">
                  Type <span className="font-mono font-bold">RESET</span> to confirm
                </label>
                <input
                  id="reset-confirmation"
                  type="text"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  className="mt-1 w-full rounded border border-brand-border bg-white p-2 font-mono text-sm"
                  autoComplete="off"
                  autoFocus
                />
                <div className="mt-4 flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => { setShowResetDialog(false); setResetConfirmation(''); }}
                    disabled={isResetting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={resetAllData}
                    disabled={resetConfirmation.trim() !== 'RESET' || isResetting}
                    className="border-red-300 bg-red-600 text-white hover:bg-red-700"
                  >
                    {isResetting ? 'Resetting…' : 'Reset profile'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
