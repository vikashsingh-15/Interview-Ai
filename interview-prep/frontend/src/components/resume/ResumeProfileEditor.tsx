'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

type Props = { resumeId: string; resumeName: string; onClose: () => void };
const input = 'w-full min-w-0 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm';
const lines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean);

export function ResumeProfileEditor({ resumeId, resumeName, onClose }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [skill, setSkill] = useState('');

  useEffect(() => {
    let alive = true;
    api.get(`/resume/${resumeId}/profile`).then(result => { if (alive) setProfile(result.data.data); })
      .catch(() => { if (alive) setError('Could not load this resume profile.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [resumeId]);

  const updateItem = (kind: 'experience' | 'projects', index: number, patch: any) => setProfile((current: any) => ({
    ...current, [kind]: current[kind].map((entry: any, i: number) => i === index ? { ...entry, ...patch } : entry),
  }));
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await api.put(`/resume/${resumeId}/profile`, {
        fullName: profile.fullName, currentRole: profile.currentRole,
        totalExperienceMonths: profile.totalExperienceMonths,
        skills: profile.skills, experience: profile.experience, projects: profile.projects,
      });
      setProfile(result.data.data); setNotice('Profile saved. Archived items will not be used for future practice.');
    } catch (cause: any) { setError(cause.response?.data?.error?.message || 'Could not save this profile.'); }
    finally { setSaving(false); }
  };

  if (loading) return <section className="rounded-xl border border-brand-border p-5" aria-busy="true">Loading profile…</section>;
  if (!profile) return <section className="rounded-xl border border-brand-border p-5"><p role="alert">{error}</p><button type="button" onClick={onClose}>Close</button></section>;
  return <section className="space-y-5 rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-semibold">Edit profile · {resumeName}</h3><p className="text-sm text-brand-textSecondary">Edits are separate from the uploaded file and affect future questions only.</p></div><button type="button" className="rounded-lg border border-brand-border px-3 py-2 text-sm" onClick={onClose}>Close</button></div>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <label className="block text-sm">Current role<input className={input} value={profile.currentRole || ''} onChange={e => setProfile({ ...profile, currentRole: e.target.value })} /></label>
    <div className="space-y-2"><h4 className="font-semibold">Technical skills</h4><div className="flex flex-wrap gap-2">{profile.skills.map((entry: any, index: number) => <span key={entry._id || index} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${entry.isRemoved ? 'opacity-50 line-through' : ''}`}>
      <input aria-label="Skill name" className="w-28 bg-transparent outline-none" value={entry.name} onChange={e => setProfile({ ...profile, skills: profile.skills.map((s: any, i: number) => i === index ? { ...s, name: e.target.value } : s) })} />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(entry.isConfirmed && !entry.isRemoved)} onChange={e => setProfile({ ...profile, skills: profile.skills.map((s: any, i: number) => i === index ? { ...s, isConfirmed: e.target.checked, isRemoved: false } : s) })} />Use</label>
      <button type="button" aria-label={entry.isRemoved ? 'Restore skill' : 'Archive skill'} onClick={() => setProfile({ ...profile, skills: profile.skills.map((s: any, i: number) => i === index ? { ...s, isRemoved: !s.isRemoved, isConfirmed: false } : s) })}>×</button>
    </span>)}</div><form className="flex gap-2" onSubmit={event => { event.preventDefault(); const name = skill.trim(); if (!name || profile.skills.some((s: any) => s.name.trim().toLowerCase() === name.toLowerCase())) return; setProfile({ ...profile, skills: [...profile.skills, { name, category: 'other', confidence: 1, source: 'user', isConfirmed: true, isRemoved: false }] }); setSkill(''); }}><input className={input} aria-label="Add a skill" placeholder="Add a skill" value={skill} onChange={e => setSkill(e.target.value)} /><button className="shrink-0 rounded-lg border px-3" type="submit">Add</button></form></div>
    {(['experience', 'projects'] as const).map(kind => <div key={kind} className="space-y-3"><h4 className="font-semibold">{kind === 'experience' ? 'Experience' : 'Projects'}</h4>{profile[kind].map((entry: any, index: number) => <article key={entry._id || `${kind}-${index}`} className={`space-y-2 rounded-lg border border-brand-border p-3 ${entry.isRemoved ? 'opacity-60' : ''}`}>
      {kind === 'experience' ? <div className="grid gap-2 sm:grid-cols-2"><input className={input} aria-label="Company" placeholder="Company" value={entry.company || ''} onChange={e => updateItem(kind, index, { company: e.target.value })} /><input className={input} aria-label="Role" placeholder="Role" value={entry.role || ''} onChange={e => updateItem(kind, index, { role: e.target.value })} /></div> : <><input className={input} aria-label="Project name" placeholder="Project name" value={entry.name || ''} onChange={e => updateItem(kind, index, { name: e.target.value })} /><textarea className={input} aria-label="Project description" placeholder="Description" value={entry.description || ''} onChange={e => updateItem(kind, index, { description: e.target.value })} /></>}
      <input className={input} aria-label="Technologies" placeholder="Technologies, comma-separated" value={(entry.technologies || []).join(', ')} onChange={e => updateItem(kind, index, { technologies: e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean) })} />
      <textarea className={input} aria-label="Responsibilities" placeholder="Responsibilities, one per line" value={(entry.responsibilities || []).join('\n')} onChange={e => updateItem(kind, index, { responsibilities: lines(e.target.value) })} />
      <div className="flex flex-wrap justify-between gap-3"><label className="text-sm"><input type="checkbox" checked={Boolean(entry.isConfirmed && !entry.isRemoved)} onChange={e => updateItem(kind, index, { isConfirmed: e.target.checked, isRemoved: false })} /> Confirm for future practice</label><button type="button" className="text-sm text-red-700 underline" onClick={() => updateItem(kind, index, { isRemoved: true, isConfirmed: false })}>Archive</button></div>
    </article>)}<button type="button" className="text-sm text-blue-700 underline" onClick={() => setProfile({ ...profile, [kind]: [...profile[kind], kind === 'experience' ? { company: '', role: '', responsibilities: [], technologies: [], achievements: [], projectReferences: [], technicalClaims: [], currentRole: false, isConfirmed: false, isRemoved: false } : { name: '', description: '', technologies: [], responsibilities: [], architectureClaims: [], features: [], performanceClaims: [], metrics: [], securityClaims: [], technicalDecisions: [], isConfirmed: false, isRemoved: false }] })}>Add {kind === 'experience' ? 'experience' : 'project'}</button></div>)}
    <button type="button" disabled={saving} className="rounded-lg bg-brand-secondary px-4 py-2 font-medium text-white disabled:opacity-50" onClick={() => void save()}>{saving ? 'Saving…' : 'Save profile'}</button>
  </section>;
}
