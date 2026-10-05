'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { ResumeSummary } from '@/types';

export function ResumeManager() {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');

  const load = async () => {
    try { setResumes((await api.get<{ data: ResumeSummary[] }>('/resume/list')).data.data); }
    catch { setError('Could not load resumes.'); }
  };
  useEffect(() => { void load(); }, []);

  const activate = async (id: string) => {
    try { await api.post(`/resume/${id}/activate`); await load(); }
    catch { setError('Could not activate that resume.'); }
  };
  const rename = async (resume: ResumeSummary) => {
    const next = window.prompt('Resume name', resume.name)?.trim();
    if (!next || next === resume.name) return;
    try { await api.patch(`/resume/${resume.id}`, { name: next, targetRole: resume.targetRole }); await load(); }
    catch { setError('Could not rename that resume.'); }
  };

  return <section className="space-y-5">
    <div><h1 className="text-3xl font-bold text-brand-primary">My Resumes</h1><p className="mt-1 text-brand-textSecondary">Choose the resume that should guide future practice. Historical questions keep their original context.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      {resumes.map(resume => <article key={resume.id} className="rounded-xl border border-brand-border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{resume.name}</h2><p className="text-sm text-brand-textSecondary">{resume.targetRole || 'No target role set'}</p></div>{resume.isActive && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">ACTIVE</span>}</div>
        <p className="mt-4 text-sm text-brand-textSecondary">{resume.skills.slice(0, 6).join(' · ') || 'Parsing or review pending'}</p>
        <p className="mt-2 text-sm">{resume.projectsCount} projects · {resume.experienceCount} experiences · version {resume.versionNumber}</p>
        <div className="mt-5 flex gap-2">{!resume.isActive && <button className="rounded-lg bg-brand-secondary px-3 py-2 text-sm font-medium text-white" onClick={() => void activate(resume.id)}>Activate</button>}<button className="rounded-lg border border-brand-border px-3 py-2 text-sm" onClick={() => void rename(resume)}>Rename</button></div>
      </article>)}
    </div>
    {!resumes.length && <p className="rounded-xl border border-dashed border-brand-border p-8 text-center text-brand-textSecondary">No resumes uploaded yet.</p>}
    <div className="rounded-xl border border-brand-border bg-white p-5"><h2 className="font-semibold">Upload a new resume</h2><div className="mt-3 flex flex-wrap gap-2"><input aria-label="Resume name" className="rounded-lg border border-brand-border px-3 py-2" placeholder="Name, e.g. SDE" value={name} onChange={e => setName(e.target.value)} /><input aria-label="Resume file" type="file" accept=".pdf,.docx" id="resume-file" className="rounded-lg border border-brand-border px-3 py-2" /><button className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white" onClick={async () => { const file = (document.getElementById('resume-file') as HTMLInputElement).files?.[0]; if (!file) return; const form = new FormData(); form.append('file', file); form.append('name', name || file.name.replace(/\.[^.]+$/, '')); await api.post('/resume/upload', form); setName(''); await load(); }}>Upload</button></div></div>
  </section>;
}
