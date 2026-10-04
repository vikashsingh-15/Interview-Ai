'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';

type Unit = 'count' | 'questions' | 'problems' | 'minutes' | 'hours' | 'session' | 'boolean';
type Frequency = 'daily' | 'weekly' | 'monthly';
interface TrackerTask {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  targetValue: number;
  unit: Unit;
  frequency: Frequency;
  systemKey?: string;
}
interface TodayData {
  dateKey: string;
  tasks: TrackerTask[];
  entries: Array<{ _id: string; taskId: string; actual: number; completed: boolean }>;
  suggestedInterviewQuestions: number;
  analytics: { completed: number; total: number; completionPercent: number; currentStreak: number };
}

const units: Unit[] = ['count', 'questions', 'problems', 'minutes', 'hours', 'session', 'boolean'];

export function TrackerSection() {
  const [data, setData] = useState<TodayData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await api.get('/tracker/today');
      const result: TodayData = response.data.data;
      setData(result);
      setDrafts(Object.fromEntries(result.entries.map((entry) => [entry.taskId, String(entry.actual)])));
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not load your tracker.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveProgress = async (task: TrackerTask, actual: number) => {
    if (!data) return;
    setBusyId(task._id);
    setError(null);
    try {
      await api.post('/tracker/entries', {
        taskId: task._id,
        dateKey: data.dateKey,
        actual,
        completed: task.unit === 'boolean' ? actual >= 1 : undefined,
      });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not save progress.');
    } finally {
      setBusyId(null);
    }
  };

  const createTask = async (event: FormEvent) => {
    event.preventDefault();
    setBusyId('new');
    try {
      await api.post('/tracker/tasks', { name: newName, targetValue: Number(newTarget), unit: 'count', frequency: 'daily' });
      setNewName(''); setNewTarget('1'); setAdding(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not add the tracker task.');
    } finally { setBusyId(null); }
  };

  const removeTask = async (task: TrackerTask) => {
    setBusyId(task._id);
    try { await api.delete(`/tracker/tasks/${task._id}`); await load(); }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Could not remove the task.'); }
    finally { setBusyId(null); }
  };

  const updateTask = async (task: TrackerTask, changes: Partial<TrackerTask>) => {
    setBusyId(task._id);
    try { await api.put(`/tracker/tasks/${task._id}`, changes); await load(); }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Could not update the task.'); }
    finally { setBusyId(null); }
  };

  if (loading) return <Card className="mb-8"><CardContent className="p-6 text-sm text-brand-textSecondary">Loading your tracker…</CardContent></Card>;
  if (!data) return <Card className="mb-8"><CardContent className="p-6"><p role="alert" className="text-sm text-red-600">{error || 'Tracker unavailable.'}</p><Button className="mt-3" size="sm" onClick={() => { setLoading(true); void load(); }}>Retry</Button></CardContent></Card>;

  const entryByTask = new Map(data.entries.map((entry) => [entry.taskId, entry]));
  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div><CardTitle>Daily tracker</CardTitle><p className="mt-1 text-sm text-brand-textSecondary">{data.analytics.completed}/{data.analytics.total} targets completed · {data.analytics.currentStreak} day streak</p></div>
        <Link className="text-sm text-brand-secondary hover:underline" href="/history?tab=tracker">Tracker history</Link>
      </CardHeader>
      <CardContent>
        <Progress value={data.analytics.completed} max={Math.max(data.analytics.total, 1)} />
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 divide-y divide-brand-border">
          {data.tasks.map((task) => {
            const entry = entryByTask.get(task._id);
            const actual = Number(drafts[task._id] ?? entry?.actual ?? 0);
            const suggestion = task.systemKey === 'interview-practice' ? data.suggestedInterviewQuestions : undefined;
            return <div key={task._id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="font-medium text-brand-primary">{task.name}</span><Badge variant="neutral">{task.frequency}</Badge><span className="text-xs text-brand-textSecondary">Target {task.targetValue} {task.unit}</span></div>
                <div className="flex items-center gap-2">
                  {task.unit === 'boolean' ? <input aria-label={`${task.name} complete`} type="checkbox" checked={actual >= 1} onChange={(event) => { const value = event.target.checked ? 1 : 0; setDrafts((old) => ({ ...old, [task._id]: String(value) })); void saveProgress(task, value); }} /> : <input aria-label={`${task.name} actual progress`} type="number" min="0" max="1000000" step="1" value={drafts[task._id] ?? entry?.actual ?? 0} onChange={(event) => setDrafts((old) => ({ ...old, [task._id]: event.target.value }))} className="w-20 rounded-md border border-brand-border px-2 py-1 text-sm" />}
                  {task.unit !== 'boolean' && <Button size="sm" variant="secondary" isLoading={busyId === task._id} onClick={() => saveProgress(task, actual)}>Save</Button>}
                  <Button size="sm" variant="ghost" onClick={() => removeTask(task)}>Remove</Button>
                </div>
              </div>
              {suggestion !== undefined && <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-brand-textSecondary"><span>From today&apos;s interview activity: {suggestion} questions</span>{suggestion > 0 && suggestion !== actual && <Button size="sm" variant="ghost" onClick={() => setDrafts((old) => ({ ...old, [task._id]: String(suggestion) }))}>Use suggestion</Button>}</div>}
              <Progress className="mt-2" value={Math.min(actual, task.targetValue)} max={task.targetValue} />
            </div>;
          })}
        </div>
        {adding ? <form onSubmit={createTask} className="mt-4 flex flex-wrap gap-2">
          <input required maxLength={100} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Task name" className="min-w-40 flex-1 rounded-md border border-brand-border px-3 py-2 text-sm" />
          <input required type="number" min="0.01" value={newTarget} onChange={(event) => setNewTarget(event.target.value)} aria-label="Target" className="w-24 rounded-md border border-brand-border px-3 py-2 text-sm" />
          <Button type="submit" size="sm" isLoading={busyId === 'new'}>Add task</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </form> : <Button className="mt-4" size="sm" variant="secondary" onClick={() => setAdding(true)}>Add tracker task</Button>}
        <details className="mt-4"><summary className="cursor-pointer text-sm text-brand-textSecondary">Edit task settings</summary><div className="mt-3 space-y-2">{data.tasks.map((task) => <div key={`edit-${task._id}`} className="flex flex-wrap items-center gap-2 text-sm">{editingId === task._id ? <><input aria-label={`${task.name} name`} maxLength={100} value={editingName} onChange={(event) => setEditingName(event.target.value)} className="min-w-40 flex-1 rounded border border-brand-border px-2 py-1"/><Button size="sm" isLoading={busyId === task._id} onClick={async () => { await updateTask(task, { name: editingName } as Partial<TrackerTask>); setEditingId(null); }}>Save name</Button></> : <><span className="min-w-40 flex-1">{task.name}</span><Button size="sm" variant="ghost" onClick={() => { setEditingId(task._id); setEditingName(task.name); }}>Rename</Button></>}<input aria-label={`${task.name} target`} type="number" min="0.01" value={task.targetValue} onBlur={(event) => { const value = Number(event.currentTarget.value); if (value !== task.targetValue) void updateTask(task, { targetValue: value }); }} className="w-20 rounded border border-brand-border px-2 py-1"/><select aria-label={`${task.name} frequency`} value={task.frequency} onChange={(event) => updateTask(task, { frequency: event.target.value as Frequency })} className="rounded border border-brand-border px-2 py-1">{(['daily', 'weekly', 'monthly'] as Frequency[]).map((frequency) => <option key={frequency}>{frequency}</option>)}</select><select aria-label={`${task.name} unit`} value={task.unit} onChange={(event) => updateTask(task, { unit: event.target.value as Unit })} className="max-w-32 rounded border border-brand-border px-2 py-1">{units.map((unit) => <option key={unit}>{unit}</option>)}</select></div>)}</div></details>
      </CardContent>
    </Card>
  );
}
