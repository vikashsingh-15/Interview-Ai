'use client';
import { useEffect,useRef,useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
export default function MockInterviewPage() {
  const {user,isLoading}=useAuth();const router=useRouter();
  const [topic,setTopic]=useState(''),[type,setType]=useState('technical'),[interview,setInterview]=useState<any>(null);
  const [answer,setAnswer]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [restoring,setRestoring]=useState(true),[feedbackNotes,setFeedbackNotes]=useState<Record<number,string>>({});
  const [draftStatus,setDraftStatus]=useState('');
  const draftTimer=useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(()=>{if(!isLoading&&!user)router.replace('/login');},[user,isLoading,router]);
  useEffect(()=>{
    if(!user) return;
    let active=true;
    try {
      const saved=localStorage.getItem(`mock-interview:${user.id}`);
      if(saved) api.get(`/mock-interviews/${encodeURIComponent(saved)}`).then(res=>{
        if(active) setInterview(res.data.data);
      }).catch(()=>{ if(active) setMessage('Could not restore your interview. You can start a new one.'); }).finally(()=>{if(active)setRestoring(false);});
      else api.get('/mock-interviews/active').then(res=>{if(active && res.data.data)setInterview(res.data.data);}).catch(()=>{if(active)setMessage('Could not restore an active interview.');}).finally(()=>{if(active)setRestoring(false);});
    } catch { setRestoring(false); }
    return ()=>{active=false;};
  },[user]);
  useEffect(()=>{
    if(!user || !interview?._id) return;
    try { localStorage.setItem(`mock-interview:${user.id}`,interview._id); } catch { /* Storage may be unavailable. */ }
  },[user,interview?._id]);
  async function act(fn:()=>Promise<void>) {setBusy(true);setMessage('');try{await fn();}catch(e:any){setMessage(e.response?.data?.error?.message||'Interview is temporarily unavailable');}finally{setBusy(false);}}
  const turn=interview?.questions.findIndex((q:any)=>q.status==='asked') ?? -1;
  const draftKey=user && interview?._id && turn>=0 ? `mock-answer:${user.id}:${interview._id}:${turn}` : null;
  const storedDraft=turn>=0 ? interview?.questions[turn]?.draft || '' : '';
  useEffect(()=>{
    if(!draftKey) { setAnswer(''); return; }
    try { setAnswer(localStorage.getItem(draftKey) ?? storedDraft); } catch { setAnswer(storedDraft); }
  },[draftKey,storedDraft]);
  useEffect(()=>()=>{if(draftTimer.current)clearTimeout(draftTimer.current);},[]);
  function updateAnswer(value:string) {
    setAnswer(value);
    try { if(draftKey) localStorage.setItem(draftKey,value); } catch { /* Storage may be unavailable. */ }
    if(draftTimer.current) clearTimeout(draftTimer.current);
    setDraftStatus('Saving draft…');
    const id=interview?._id, currentTurn=turn;
    draftTimer.current=setTimeout(()=>{api.put(`/mock-interviews/${id}/draft`,{turn:currentTurn,draft:value}).then(()=>setDraftStatus('Draft saved to your account')).catch(()=>setDraftStatus('Draft saved locally; account sync failed.'));},800);
  }
  async function submitAnswer() {
    if(draftTimer.current) clearTimeout(draftTimer.current);
    const id=interview._id, submittedTurn=turn, submittedAnswer=answer, key=draftKey;
    try {
      const response=await api.post(`/mock-interviews/${id}/answer`,{turn:submittedTurn,answer:submittedAnswer});
      try { if(key) localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
      setInterview(response.data.data); setAnswer('');
    } catch(error) {
      try {
        const latest=(await api.get(`/mock-interviews/${id}`)).data.data;
        setInterview(latest);
        if(latest.questions[submittedTurn]?.status === 'answered' && latest.questions[submittedTurn]?.response === submittedAnswer) {
          try { if(key) localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
          setMessage('Your answer was saved.'); return;
        }
      } catch { /* Keep the draft for another attempt. */ }
      throw error;
    }
  }
  return <main className="max-w-3xl mx-auto p-6 space-y-5"><h1 className="text-3xl font-bold">Personal interviewer</h1>
    <p>Practice a selected topic from your profile. Follow-ups respond to your answers; they are not a prewritten list.</p>
    <p role="status">{message}</p>
    {restoring ? <p>Restoring your interview…</p> : !interview?<form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(async()=>setInterview((await api.post('/mock-interviews/start',{topic,type})).data.data));}}>
      <label className="block">Topic<input className="block w-full border rounded p-2" value={topic} required onChange={e=>setTopic(e.target.value)} /></label>
      <label className="block">Interview type<select className="block w-full border rounded p-2" value={type} onChange={e=>setType(e.target.value)}>{['technical','system_design','project_deep_dive','behavioral','leadership','custom'].map(v=><option key={v}>{v}</option>)}</select></label>
      <button className="bg-blue-700 text-white rounded p-2" disabled={busy}>Start interview</button>
    </form>:<>
      {interview.questions.map((q:any,i:number)=><section key={i} className="rounded border p-4 space-y-2">
        <h2 className="font-semibold">{q.isFollowUp?'Follow-up: ':''}{q.questionSnapshot.question}</h2>
        {q.response&&<p className="whitespace-pre-wrap">{q.response}</p>}
        {q.evaluation&&<div className="space-y-2 text-sm">
          <p>Coaching ({q.evaluation.source}): {q.evaluation.summary}</p>
          <p>Scores: {(['technicalCorrectness','completeness','depth','clarity'] as const).map(key=>`${key.replace(/([A-Z])/g,' $1')}: ${Math.round((q.evaluation[key] || 0)*100)}%`).join(' · ')}</p>
          {q.evaluation.evidence?.map((item:any,j:number)=><p key={j}><strong>{item.criterion}:</strong> “{item.quote}” — {item.explanation}</p>)}
          {q.evaluation.missingPoints?.length>0 && <p><strong>Points to consider:</strong> {q.evaluation.missingPoints.join('; ')}</p>}
          {q.evaluation.improvementSuggestions?.length>0 && <p><strong>Suggestions:</strong> {q.evaluation.improvementSuggestions.join('; ')}</p>}
          {q.referenceAnswer && <details><summary>Compare with reference answer</summary><p className="whitespace-pre-wrap">{q.referenceAnswer}</p></details>}
          <form onSubmit={e=>{e.preventDefault();void act(async()=>{await api.post(`/mock-interviews/${interview._id}/evaluation-feedback`,{turn:i,notes:feedbackNotes[i]});setFeedbackNotes(prev=>({...prev,[i]:''}));setMessage('Feedback saved.');});}}>
            <label className="block">Disagree with this feedback?<textarea className="block w-full rounded border p-2" maxLength={2000} value={feedbackNotes[i] || ''} onChange={e=>setFeedbackNotes(prev=>({...prev,[i]:e.target.value}))} /></label>
            <button className="mt-1 rounded border px-2 py-1" disabled={busy || !feedbackNotes[i]?.trim()}>Send feedback</button>
          </form>
        </div>}
      </section>)}
      {turn>=0?<form onSubmit={e=>{e.preventDefault();void act(submitAnswer);}}>
        <label>Your answer<textarea className="block w-full border rounded p-3" rows={8} minLength={10} required value={answer} onChange={e=>updateAnswer(e.target.value)} /></label>
        <p className="text-sm" role="status">{draftStatus}</p>
        <button className="bg-blue-700 text-white rounded p-2 mt-3" disabled={busy}>Submit and continue</button>
      </form>:<div><p>Interview complete. Scores are coaching estimates, not a hiring prediction.</p><button className="mt-3 rounded border p-2" onClick={()=>{try { if(user) localStorage.removeItem(`mock-interview:${user.id}`); } catch { /* Storage may be unavailable. */ } setInterview(null);}}>Start another interview</button></div>}
    </>}
  </main>;
}
