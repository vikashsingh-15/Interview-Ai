'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { SignInPrompt } from '@/components/auth/SignInPrompt';

type Requirement = { requirement:string; jobQuote:string; resumeEvidence:string; topic:string; suggestion:string };

export default function JobPreparationPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [description,setDescription] = useState('');
  const [requirements,setRequirements] = useState<Requirement[] | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function analyze(event:FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setRequirements(null);
    try {
      const response=await api.post('/profile/job-preparation',{description});
      setRequirements(response.data.data.requirements);
    } catch (err:any) { setError(err.response?.data?.error?.message || 'Could not analyze this job description. Please try again.'); }
    finally { setBusy(false); }
  }
  if(isLoading || !isAuthenticated) return <SignInPrompt pageName="job preparation" returnTo="/job-preparation" isLoading={isLoading} />;
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-3xl font-bold">Prepare for a job</h1>
    <p>Paste a job description to compare its requirements with your confirmed resume and choose topics to practice.</p>
    <form onSubmit={analyze} className="space-y-3">
      <label className="block">Job description<textarea className="mt-2 block w-full rounded border p-3" rows={10} minLength={40} maxLength={12000} required value={description} onChange={event=>setDescription(event.target.value)} /></label>
      <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>{busy ? 'Analyzing…' : 'Build preparation plan'}</button>
    </form>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {requirements && <section className="space-y-4"><h2 className="text-xl font-semibold">Suggested preparation</h2>
      <p className="text-sm">Review these suggestions. A missing resume match does not mean you lack the skill.</p>
      {requirements.length === 0 && <p>No supported requirements were returned. Try a more detailed description.</p>}
      {requirements.map((item,index)=><article key={index} className="space-y-2 rounded border p-4">
        <h3 className="font-semibold">{item.requirement}</h3><p className="text-sm">Job description: “{item.jobQuote}”</p>
        <p className="text-sm">{item.resumeEvidence ? `Confirmed resume evidence: ${item.resumeEvidence}` : 'No direct match found in confirmed resume facts.'}</p>
        <p>{item.suggestion}</p><Link className="text-blue-700 underline" href={`/topics?topic=${encodeURIComponent(item.topic)}`}>Practice {item.topic}</Link>
      </article>)}
    </section>}
  </main>;
}
