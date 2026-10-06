'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';

interface TrackerTask { _id: string; name: string; unit: string; frequency: string; }
interface Entry { _id: string; taskId: string | { _id: string; name: string; unit: string }; dateKey: string; target: number; actual: number; completed: boolean; notes?: string; }
const key = (date: Date) => date.toISOString().slice(0, 10);
const monthLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function TrackerHistory() {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); });
  const [tasks, setTasks] = useState<TrackerTask[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [range, setRange] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const year = month.getUTCFullYear(), monthNumber = month.getUTCMonth() + 1;
  const monthStart = key(month);
  const monthEnd = key(new Date(Date.UTC(year, monthNumber, 0)));

  const period = useMemo(() => {
    if (range === 'custom' && customStart && customEnd) return [customStart, customEnd];
    if (range === 'today') { const today = key(new Date()); return [today, today]; }
    if (range === 'week') { const today = new Date(); const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - today.getUTCDay())); return [key(start), key(new Date(start.getTime() + 6 * 86400000))]; }
    return [monthStart, monthEnd];
  }, [range, customStart, customEnd, monthStart, monthEnd]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskResponse, entryResponse, analyticsResponse] = await Promise.all([
        api.get('/tracker/tasks'),
        api.get(`/tracker/entries?start=${period[0]}&end=${period[1]}`),
        api.get(range === 'today' ? '/tracker/analytics/today' : range === 'week' ? '/tracker/analytics/week' : `/tracker/analytics/target-vs-actual?period=month&year=${year}&month=${monthNumber}`),
      ]);
      setTasks(taskResponse.data.data || []);
      setEntries(entryResponse.data.data || []);
      setAnalytics(analyticsResponse.data.data);
      setError(null);
      setSelectedDate(period[1]);
    } catch (err: any) { setError(err?.response?.data?.error?.message || 'Could not load tracker history.'); }
    finally { setLoading(false); }
  }, [period, year, monthNumber, range]);
  useEffect(() => { void load(); }, [load]);

  const visibleEntries = entries.filter((entry) => taskFilter === 'all' || (typeof entry.taskId === 'string' ? entry.taskId : entry.taskId?._id) === taskFilter);
  const selectedEntries = visibleEntries.filter((entry) => entry.dateKey === selectedDate);
  const entriesByDay = useMemo(() => {
    const grouped = new Map<string, Entry[]>();
    for (const entry of visibleEntries) grouped.set(entry.dateKey, [...(grouped.get(entry.dateKey) || []), entry]);
    return grouped;
  }, [visibleEntries]);
  const unitStats = new Map<string, { actual: number; target: number }>();
  for (const entry of visibleEntries) {
    const taskId = typeof entry.taskId === 'string' ? entry.taskId : entry.taskId?._id;
    const unit = typeof entry.taskId === 'string' ? tasks.find((task) => task._id === taskId)?.unit || 'units' : entry.taskId?.unit || 'units';
    const stats = unitStats.get(unit) || { actual: 0, target: 0 };
    stats.actual += entry.actual; stats.target += entry.target; unitStats.set(unit, stats);
  }
  const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const shiftMonth = (step: number) => setMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + step, 1)));

  return <Card>
    <CardHeader className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Tracker history</CardTitle><p className="mt-1 text-sm text-brand-textSecondary">Review daily progress and targets</p></div><div className="flex items-center gap-2"><Button size="sm" variant="secondary" aria-label="Previous month" onClick={() => shiftMonth(-1)}>←</Button><span className="min-w-36 text-center font-medium">{monthLabel(month)}</span><Button size="sm" variant="secondary" aria-label="Next month" onClick={() => shiftMonth(1)}>→</Button></div></CardHeader>
    <CardContent>
      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="mb-4 flex flex-wrap items-end gap-3"><label className="text-sm">Period<select value={range} onChange={(event) => setRange(event.target.value)} className="mt-1 block rounded border border-brand-border px-2 py-1"><option value="today">Today</option><option value="week">This week</option><option value="month">Month</option><option value="custom">Custom</option></select></label>{range === 'custom' && <><label className="text-sm">Start<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 block rounded border border-brand-border px-2 py-1"/></label><label className="text-sm">End<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 block rounded border border-brand-border px-2 py-1"/></label></>}<label className="text-sm">Task<select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)} className="mt-1 block rounded border border-brand-border px-2 py-1"><option value="all">All tasks</option>{tasks.map((task) => <option key={task._id} value={task._id}>{task.name}</option>)}</select></label></div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-lg bg-brand-success/10 p-3"><p className="text-xs text-brand-textSecondary">{range === 'month' ? 'Month' : 'Selected period'} completion</p><p className="font-semibold text-brand-text">{analytics?.completionPercent ?? 0}%</p></div><div className="rounded-lg bg-brand-warning/10 p-3"><p className="text-xs text-brand-textSecondary">Current streak</p><p className="font-semibold text-brand-text">{analytics?.currentStreak ?? 0} days</p></div>{[...unitStats.entries()].slice(0, 2).map(([unit, stats]) => <div key={unit} className="rounded-lg bg-brand-primary/5 p-3"><p className="text-xs capitalize text-brand-textSecondary">{unit} target / actual</p><p className="font-semibold text-brand-text">{stats.target} / {stats.actual}</p></div>)}</div>
      {loading ? <p className="py-8 text-center text-sm text-brand-textSecondary">Loading tracker history…</p> : <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div><div className="grid grid-cols-7 gap-1 text-center text-xs text-brand-textSecondary">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <span key={day} className="py-2">{day}</span>)}</div><div className="grid grid-cols-7 gap-1">{cells.map((day, index) => {
          if (!day) return <div key={`blank-${index}`} className="min-h-16 rounded border border-transparent sm:min-h-20"/>;
          const dateKey = key(new Date(Date.UTC(year, monthNumber - 1, day)));
          const rows = entriesByDay.get(dateKey) || [];
          const done = rows.filter((entry) => entry.completed).length;
          const color = !rows.length ? 'bg-brand-surface' : done === rows.length ? 'bg-brand-success/10 border-brand-success/30' : done ? 'bg-brand-warning/10 border-brand-warning/30' : 'bg-brand-error/10 border-brand-error/30';
          return <button key={dateKey} type="button" onClick={() => setSelectedDate(dateKey)} aria-pressed={selectedDate === dateKey} className={`min-h-16 rounded-lg border p-1 text-left text-sm sm:min-h-20 sm:p-2 ${color} ${selectedDate === dateKey ? 'ring-2 ring-brand-secondary' : 'border-brand-border'}`}><span>{day}</span>{rows.length > 0 && <span className="mt-1 block text-[10px] text-brand-textSecondary">{done}/{rows.length} done</span>}</button>;
        })}</div></div>
        <div className="rounded-xl border border-brand-border p-4"><h3 className="font-semibold text-brand-primary">{selectedDate || 'Choose a date'}</h3>{selectedEntries.length ? <div className="mt-3 space-y-3">{selectedEntries.map((entry) => { const task = typeof entry.taskId === 'string' ? tasks.find((item) => item._id === entry.taskId) : entry.taskId; return <div key={entry._id} className="border-b border-brand-border pb-3 last:border-0"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{task?.name || 'Tracker task'}</p><Badge variant={entry.completed ? 'success' : 'warning'}>{entry.completed ? 'Complete' : 'In progress'}</Badge></div><p className="mt-1 text-xs text-brand-textSecondary">{entry.actual} / {entry.target} {task?.unit || ''}</p><Progress className="mt-2" value={Math.min(entry.actual, entry.target)} max={entry.target || 1}/>{entry.notes && <p className="mt-2 text-sm">{entry.notes}</p>}</div>; })}</div> : <p className="mt-3 text-sm text-brand-textSecondary">No saved tracker entries for this date and filter.</p>}</div>
      </div>}
    </CardContent>
  </Card>;
}
