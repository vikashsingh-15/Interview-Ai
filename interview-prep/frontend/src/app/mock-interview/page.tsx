'use client';
import { useEffect,useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
export default function MockInterviewPage() {
  const {user,isLoading}=useAuth();const router=useRouter();
  const [topic,setTopic]=useState(''),[type,setType]=useState('technical'),[interview,setInterview]=useState<any>(null);
  const [answer,setAnswer]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!isLoading&&!user)router.replace('/login');},[user,isLoading,router]);
  async function act(fn:()=>Promise<void>) {setBusy(true);setMessage('');try{await fn();}catch(e:any){setMessage(e.response?.data?.error?.message||'Interview is temporarily unavailable');}finally{setBusy(false);}}
  const turn=interview?.questions.findIndex((q:any)=>q.status==='asked') ?? -1;
  return <main className="max-w-3xl mx-auto p-6 space-y-5"><h1 className="text-3xl font-bold">Personal interviewer</h1>
    <p>Practice a selected topic from your profile. Follow-ups respond to your answers; they are not a prewritten list.</p>
    <p role="status">{message}</p>
    {!interview?<form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(async()=>setInterview((await api.post('/mock-interviews/start',{topic,type})).data.data));}}>
      <label className="block">Topic<input className="block w-full border rounded p-2" value={topic} required onChange={e=>setTopic(e.target.value)} /></label>
      <label className="block">Interview type<select className="block w-full border rounded p-2" value={type} onChange={e=>setType(e.target.value)}>{['technical','system_design','project_deep_dive','behavioral','leadership','custom'].map(v=><option key={v}>{v}</option>)}</select></label>
      <button className="bg-blue-700 text-white rounded p-2" disabled={busy}>Start interview</button>
    </form>:<>
      {interview.questions.map((q:any,i:number)=><section key={i} className="rounded border p-4 space-y-2">
        <h2 className="font-semibold">{q.isFollowUp?'Follow-up: ':''}{q.questionSnapshot.question}</h2>
        {q.response&&<p className="whitespace-pre-wrap">{q.response}</p>}
        {q.evaluation&&<p className="text-sm">Coaching ({q.evaluation.source}): {q.evaluation.summary}</p>}
      </section>)}
      {turn>=0?<form onSubmit={e=>{e.preventDefault();void act(async()=>{setInterview((await api.post('/mock-interviews/'+interview._id+'/answer',{turn,answer})).data.data);setAnswer('');});}}>
        <label>Your answer<textarea className="block w-full border rounded p-3" rows={8} minLength={10} required value={answer} onChange={e=>setAnswer(e.target.value)} /></label>
        <button className="bg-blue-700 text-white rounded p-2 mt-3" disabled={busy}>Submit and continue</button>
      </form>:<p>Interview complete. Scores are coaching estimates, not a hiring prediction.</p>}
    </>}
  </main>;
}
