'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';

interface PlannerTask {
  _id: string; year: number; month: number; week: number; title: string;
  description?: string; category?: string; priority: 'low' | 'medium' | 'high';
  completed: boolean; order: number;
}

const periodLabel = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
function actualWeek(day: number, firstDay: number) { return Math.floor((day + firstDay - 1) / 7) + 1; }
function nextPeriod(year: number, month: number, week: number) {
  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (week < actualWeek(finalDay, new Date(Date.UTC(year, month - 1, 1)).getUTCDay())) return { year, month, week: week + 1 };
  const next = new Date(Date.UTC(year, month, 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, week: 1 };
}

export function PlannerSection({ history = false }: { history?: boolean }) {
  const [monthDate, setMonthDate] = useState(() => { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); });
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const year = monthDate.getUTCFullYear(), month = monthDate.getUTCMonth() + 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get(`/planner/tasks?year=${year}&month=${month}`);
      setTasks(result.data.data || []);
      setError(null);
    } catch (err: any) { setError(err?.response?.data?.error?.message || 'Could not load planner goals.'); }
    finally { setLoading(false); }
  }, [year, month]);
  useEffect(() => { void load(); }, [load]);

  const weeks = useMemo(() => {
    const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return actualWeek(finalDay, new Date(Date.UTC(year, month - 1, 1)).getUTCDay());
  }, [year, month]);
  useEffect(() => { setSelectedWeek((week) => Math.min(week, weeks)); }, [weeks]);

  const changeMonth = (offset: number) => setMonthDate((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
  const createTask = async (event: FormEvent) => {
    event.preventDefault(); if (!title.trim()) return;
    setBusyId('new');
    try { await api.post('/planner/tasks', { year, month, week: selectedWeek, title: title.trim(), description: description.trim(), category: category.trim(), priority: 'medium' }); setTitle(''); setDescription(''); setCategory(''); setAdding(false); await load(); }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Could not add the planner goal.'); }
    finally { setBusyId(null); }
  };
  const toggleComplete = async (task: PlannerTask) => {
    setBusyId(task._id);
    try { await api.put(`/planner/tasks/${task._id}`, { completed: !task.completed }); await load(); }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Could not update this goal.'); }
    finally { setBusyId(null); }
  };
  const saveEdit = async (task: PlannerTask) => {
    setBusyId(task._id);
    try { await api.put(`/planner/tasks/${task._id}`, { title: editingTitle, description: editingDescription, category: editingCategory }); setEditingId(null); await load(); }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Could not edit this goal.'); }
    finally { setBusyId(null); }
  };
  const carryForward = async (task: PlannerTask) => {
    const destination = nextPeriod(task.year, task.month, task.week);
    setBusyId(task._id);
    try { await api.post(`/planner/tasks/${task._id}/carry-forward`, destination); if (destination.year === year && destination.month === month) await load(); }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Could not carry this goal forward.'); }
    finally { setBusyId(null); }
  };
  const removeTask = async (task: PlannerTask) => {
    setBusyId(task._id);
    try { await api.delete(`/planner/tasks/${task._id}`); await load(); }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Could not delete this goal.'); }
    finally { setBusyId(null); }
  };

  const displayedWeeks = history ? Array.from({ length: weeks }, (_, index) => index + 1) : Array.from({ length: Math.min(weeks, 4) }, (_, index) => index + 1);
  return <Card className="mb-8">
    <CardHeader className="flex flex-wrap items-center justify-between gap-3">
      <div><CardTitle>{history ? 'Planner history' : 'Monthly planner'}</CardTitle><p className="mt-1 text-sm text-brand-textSecondary">Goals for {periodLabel(year, month)}</p></div>
      <div className="flex items-center gap-2"><Button size="sm" variant="secondary" onClick={() => changeMonth(-1)} aria-label="Previous month">←</Button><span className="min-w-32 text-center text-sm font-medium">{periodLabel(year, month)}</span><Button size="sm" variant="secondary" onClick={() => changeMonth(1)} aria-label="Next month">→</Button></div>
    </CardHeader>
    <CardContent>
      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
      {loading ? <p className="text-sm text-brand-textSecondary">Loading goals…</p> : <>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{displayedWeeks.map((week) => {
          const entries = tasks.filter((task) => task.week === week);
          const completed = entries.filter((task) => task.completed).length;
          return <button key={week} type="button" onClick={() => setSelectedWeek(week)} className={`rounded-lg border p-3 text-left ${selectedWeek === week ? 'border-brand-secondary bg-brand-secondary/5' : 'border-brand-border'}`}><span className="block text-sm font-medium">Week {week}</span><span className="text-xs text-brand-textSecondary">{completed}/{entries.length} done</span><Progress className="mt-2" value={completed} max={Math.max(entries.length, 1)} /></button>;
        })}</div>
        {(() => { const weekTasks = tasks.filter((task) => task.week === selectedWeek); const completed = weekTasks.filter((task) => task.completed).length; const percent = weekTasks.length ? Math.round((completed / weekTasks.length) * 100) : 0; const variant = percent >= 100 ? 'success' : percent >= 60 ? 'warning' : percent > 0 ? 'intermediate' : 'error'; return <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-brand-primary">Week {selectedWeek} review</h3><span className="text-sm font-medium text-brand-textSecondary">{completed} / {weekTasks.length} completed — {percent}%</span></div><Progress value={completed} max={Math.max(weekTasks.length, 1)} variant={variant as 'default' | 'success' | 'warning' | 'error' | 'intermediate'} /></div>; })()}
        <div className="mt-3 min-w-0 space-y-2">{tasks.filter((task) => task.week === selectedWeek).map((task) => <div key={task._id} className="flex min-w-0 flex-col items-stretch gap-3 rounded-lg border border-brand-border p-3 sm:flex-row sm:items-center"><input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.completed} disabled={busyId === task._id} onChange={() => void toggleComplete(task)} className="shrink-0" /><div className="min-w-0 flex-1 break-words">{editingId === task._id ? <div className="space-y-2"><input aria-label="Edit goal title" maxLength={160} value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} className="w-full min-w-0 rounded border border-brand-border px-2 py-1 text-sm"/><input aria-label="Edit goal description" maxLength={1000} value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} placeholder="Description (optional)" className="w-full min-w-0 rounded border border-brand-border px-2 py-1 text-sm"/><div className="flex flex-wrap gap-2"><input aria-label="Edit goal category" maxLength={60} value={editingCategory} onChange={(event) => setEditingCategory(event.target.value)} placeholder="Category (optional)" className="min-w-0 flex-1 rounded border border-brand-border px-2 py-1 text-sm"/><Button size="sm" isLoading={busyId === task._id} onClick={() => void saveEdit(task)}>Save</Button></div></div> : <><p className={`break-words text-sm font-medium ${task.completed ? 'text-brand-textSecondary line-through' : 'text-brand-primary'}`}>{task.title}</p>{task.description && <p className="break-words text-xs text-brand-textSecondary">{task.description}</p>}{task.category && <Badge variant="neutral">{task.category}</Badge>}</>}</div><div className="flex max-w-full flex-wrap items-center gap-2 sm:shrink-0"><select aria-label={`Priority for ${task.title}`} value={task.priority} onChange={(event) => void api.put(`/planner/tasks/${task._id}`, { priority: event.target.value }).then(load).catch(() => setError('Could not update priority.'))} className="max-w-full rounded border border-brand-border px-2 py-1 text-xs"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>{editingId !== task._id && <Button size="sm" variant="ghost" onClick={() => { setEditingId(task._id); setEditingTitle(task.title); setEditingDescription(task.description || ''); setEditingCategory(task.category || ''); }}>Edit</Button>}{!task.completed && <Button size="sm" variant="ghost" isLoading={busyId === task._id} onClick={() => carryForward(task)}>Carry forward</Button>}<Button size="sm" variant="ghost" onClick={() => removeTask(task)}>Delete</Button></div></div>)}
          {tasks.filter((task) => task.week === selectedWeek).length === 0 && <p className="rounded-lg border border-dashed border-brand-border p-4 text-sm text-brand-textSecondary">No goals in this week yet.</p>}
        </div>
        {adding ? <form onSubmit={createTask} className="mt-4 grid gap-2 sm:grid-cols-2"><input required maxLength={160} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`Goal for week ${selectedWeek}`} className="rounded-md border border-brand-border px-3 py-2 text-sm sm:col-span-2"/><input maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description (optional)" className="rounded-md border border-brand-border px-3 py-2 text-sm"/><input maxLength={60} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category (optional)" className="rounded-md border border-brand-border px-3 py-2 text-sm"/><div className="flex gap-2 sm:col-span-2"><Button size="sm" type="submit" isLoading={busyId === 'new'}>Add</Button><Button size="sm" type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div></form> : <Button className="mt-4" size="sm" variant="secondary" onClick={() => setAdding(true)}>Add weekly goal</Button>}
      </>}
      {!history && <Link className="mt-4 inline-block text-sm text-brand-secondary hover:underline" href="/history?tab=planner">Open planner history →</Link>}
    </CardContent>
  </Card>;
}
