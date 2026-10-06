'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import type { ResumeSummary } from '@/types';
import { ResumeProfileEditor } from './ResumeProfileEditor';

function errorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response;
  return response?.data?.error?.message || response?.data?.message || fallback;
}

export function ResumeManager() {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<ResumeSummary | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ResumeSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const response = await api.get<{ data: ResumeSummary[] }>('/resume/list');
      setResumes(response.data.data);
    } catch (err) { setError(errorMessage(err, 'Could not load resumes.')); }
  };
  useEffect(() => { void load(); }, []);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Choose a PDF or DOCX file first.'); return; }
    setUploading(true); setError(''); setNotice('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name.trim() || file.name.replace(/\.[^.]+$/, ''));
      form.append('targetRole', targetRole.trim());
      form.append('createNew', 'true');
      const response = await api.post('/resume/upload', form);
      const versionId = response.data?.data?.resumeVersion?.id;
      setName(''); setTargetRole(''); if (fileRef.current) fileRef.current.value = '';
      setNotice('Resume uploaded. Extracting details now.');
      await load();
      if (versionId) {
        try { await api.post(`/resume/parse/${versionId}`); setNotice('Resume uploaded and parsed. Review the extracted details below.'); await load(); }
        catch (err) { setNotice(`Resume uploaded, but parsing needs attention: ${errorMessage(err, 'Please retry parsing from onboarding.')}`); }
      }
    } catch (err) { setError(errorMessage(err, 'Could not upload that resume.')); }
    finally { setUploading(false); }
  };

  const activate = async (resume: ResumeSummary) => {
    try { setError(''); await api.post(`/resume/${resume.id}/activate`); await load(); }
    catch (err) { setError(errorMessage(err, 'Could not activate that resume.')); }
  };
  const rename = async (resume: ResumeSummary) => {
    const next = window.prompt('Resume name', resume.name)?.trim();
    if (!next || next === resume.name) return;
    try { setError(''); await api.patch(`/resume/${resume.id}`, { name: next, targetRole: resume.targetRole }); await load(); }
    catch (err) { setError(errorMessage(err, 'Could not rename that resume.')); }
  };
  const remove = async (resume: ResumeSummary) => {
    try { setError(''); await api.delete(`/resume/${resume.id}`); setDeleteCandidate(null); await load(); }
    catch (err) { setError(errorMessage(err, 'Could not delete that resume.')); }
  };

  return <section className="space-y-5">
    <div><h2 className="text-2xl font-bold text-brand-primary">Resume Management</h2><p className="mt-1 text-brand-textSecondary">Upload separate resumes for different roles, then select the one for future practice.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-200">{notice}</p>}
    <div className="divide-y divide-brand-border rounded-xl border border-brand-border bg-brand-surface">{resumes.map(resume =>
      <article key={resume.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0"><h3 className="break-words font-semibold">{resume.name}</h3><p className="break-words text-sm text-brand-textSecondary">{resume.targetRole || 'No target role set'} · version {resume.versionNumber} · {resume.skills?.length || 0} skills · {resume.projectsCount} projects · {resume.experienceCount} roles</p></div>
        <div className="flex flex-wrap items-center gap-2">{resume.isActive && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">✓ Active</span>}{!resume.isActive && <button className="rounded-lg bg-brand-secondary px-3 py-2 text-sm font-medium text-white" onClick={() => void activate(resume)}>Activate</button>}<button className="rounded-lg border border-brand-border px-3 py-2 text-sm" onClick={() => setEditing(resume)}>Edit</button><button className="rounded-lg border border-brand-border px-3 py-2 text-sm" onClick={() => void rename(resume)}>Rename</button><button className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-300" onClick={() => setDeleteCandidate(resume)}>Delete</button></div>
      </article>
    )}</div>
    {editing && <ResumeProfileEditor key={editing.id} resumeId={editing.id} resumeName={editing.name} onClose={() => { setEditing(null); void load(); }} />}
    {deleteCandidate && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteCandidate(null); }}><div role="dialog" aria-modal="true" aria-labelledby="delete-resume-title" className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-2xl"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500" aria-hidden="true">!</div><div><h2 id="delete-resume-title" className="text-lg font-semibold text-brand-primary">Delete resume?</h2><p className="mt-1 break-words text-sm font-medium text-brand-text">{deleteCandidate.name}</p></div></div><p className="mt-4 text-sm leading-6 text-brand-textSecondary">This removes the resume from your active list. Your interview questions, answers, calendar history, tracker, planner, and other activity will remain.</p><div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-primary/10" onClick={() => setDeleteCandidate(null)}>Cancel</button><button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700" onClick={() => void remove(deleteCandidate)}>Delete resume</button></div></div></div>}
    {!resumes.length && <p className="rounded-xl border border-dashed border-brand-border p-8 text-center text-brand-textSecondary">No resumes uploaded yet.</p>}
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5"><h3 className="font-semibold">Upload a new resume</h3><div className="mt-3 flex flex-wrap gap-2"><input aria-label="Resume name" className="min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface px-3 py-2" placeholder="Name, e.g. SDE" value={name} onChange={event => setName(event.target.value)} /><input aria-label="Target role" className="min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface px-3 py-2" placeholder="Target role (optional)" value={targetRole} onChange={event => setTargetRole(event.target.value)} /><input ref={fileRef} aria-label="Resume file" type="file" accept=".pdf,.docx" className="min-w-0 max-w-full rounded-lg border border-brand-border px-3 py-2" /><button disabled={uploading} className="rounded-lg bg-brand-secondary px-3 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => void upload()}>{uploading ? 'Uploading…' : 'Upload'}</button></div></div>
  </section>;
}
