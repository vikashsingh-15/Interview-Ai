'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { SignInPrompt } from '@/components/auth/SignInPrompt';

type Requirement = { requirement:string; jobQuote:string; resumeEvidence:string; topic:string; suggestion:string; completed:boolean };
type Plan = { _id:string; title:string; description:string; requirements:Requirement[] };

export default function JobPreparationPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [description,setDescription] = useState('');
  const [title,setTitle] = useState('');
  const [plans,setPlans] = useState<Plan[]>([]);
  const [selected,setSelected] = useState<Plan | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function analyze(event:FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response=await api.post('/profile/job-preparation',{description,title:title.trim() || 'Job preparation'});
      setSelected(response.data.data); setPlans(prev=>[response.data.data,...prev]);
    } catch (err:any) { setError(err.response?.data?.error?.message || 'Could not analyze this job description. Please try again.'); }
    finally { setBusy(false); }
  }
  useEffect(()=>{ if(isAuthenticated) api.get('/profile/job-plans').then(res=>setPlans(res.data.data)).catch(()=>setError('Could not load saved plans.')); },[isAuthenticated]);
  async function toggle(index:number,completed:boolean) {
    if(!selected) return;
    try { const res=await api.patch(`/profile/job-plans/${selected._id}`,{index,completed}); setSelected(res.data.data); setPlans(prev=>prev.map(p=>p._id===selected._id?res.data.data:p)); }
    catch { setError('Could not update plan progress.'); }
  }
  async function remove() {
    if(!selected || !window.confirm('Delete this saved plan?')) return;
    try { await api.delete(`/profile/job-plans/${selected._id}`); setPlans(prev=>prev.filter(p=>p._id!==selected._id)); setSelected(null); }
    catch { setError('Could not delete this plan.'); }
  }
  if(isLoading || !isAuthenticated) return <SignInPrompt pageName="job preparation" returnTo="/job-preparation" isLoading={isLoading} />;
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-3xl font-bold">Prepare for a job</h1>
    <p>Paste a job description to compare its requirements with your confirmed resume and choose topics to practice.</p>
    {plans.length>0 && <label className="block">Saved plans<select className="ml-2 rounded border p-2" value={selected?._id || ''} onChange={e=>setSelected(plans.find(p=>p._id===e.target.value) || null)}><option value="">Select a plan</option>{plans.map(p=><option key={p._id} value={p._id}>{p.title}</option>)}</select></label>}
    <form onSubmit={analyze} className="space-y-3">
      <label className="block">Plan name<input className="mt-2 block w-full rounded border p-2" maxLength={150} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Company and role" /></label>
      <label className="block">Job description<textarea className="mt-2 block w-full rounded border p-3" rows={10} minLength={40} maxLength={12000} required value={description} onChange={event=>setDescription(event.target.value)} /></label>
      <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>{busy ? 'Analyzing…' : 'Build preparation plan'}</button>
    </form>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {selected && <section className="space-y-4"><h2 className="text-xl font-semibold">{selected.title}: suggested preparation</h2><button className="text-sm text-red-700 underline" onClick={()=>void remove()}>Delete plan</button>
      <p className="text-sm">Review these suggestions. A missing resume match does not mean you lack the skill.</p>
      {selected.requirements.length === 0 && <p>No supported requirements were returned. Try a more detailed description.</p>}
      {selected.requirements.map((item,index)=><article key={index} className="space-y-2 rounded border p-4">
        <label className="flex gap-2"><input type="checkbox" checked={item.completed} onChange={e=>void toggle(index,e.target.checked)} />Preparation completed</label>
        <h3 className="font-semibold">{item.requirement}</h3><p className="text-sm">Job description: “{item.jobQuote}”</p>
        <p className="text-sm">{item.resumeEvidence ? `Confirmed resume evidence: ${item.resumeEvidence}` : 'No direct match found in confirmed resume facts.'}</p>
        <p>{item.suggestion}</p><Link className="text-blue-700 underline" href={`/topics?topic=${encodeURIComponent(item.topic)}`}>Practice {item.topic}</Link>
      </article>)}
    </section>}
  </main>;
}
