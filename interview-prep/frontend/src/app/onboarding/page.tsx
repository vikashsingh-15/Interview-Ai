'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import Link from 'next/link';

const inputStyle = 'w-full rounded border border-gray-300 p-2 text-gray-900 bg-white';
const buttonStyle = 'rounded bg-blue-700 text-white px-4 py-2 disabled:opacity-50';
const list = (text:string) => text.split(',').map(s=>s.trim()).filter(Boolean);
export default function OnboardingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [facts,setFacts] = useState<any>(null);
  const [reviewed,setReviewed] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [role,setRole] = useState('');
  const [level,setLevel] = useState('');
  const [months,setMonths] = useState(0);
  const [companies,setCompanies] = useState('');
  const [industries,setIndustries] = useState('');
  const [focus,setFocus] = useState('');
  const [avoid,setAvoid] = useState('');
  const [difficulty,setDifficulty] = useState('mixed');
  const [date,setDate] = useState('');
  const [plan,setPlan] = useState<any[]>([]);
  async function load() {
    const { data } = await api.get('/profile/onboarding');
    const resume = data.data.resume?.profile;
    const profile = data.data.profile;
    if (resume) { setFacts(resume); setReviewed(Boolean(resume.userModified)); setMonths(resume.totalExperienceMonths || 0); }
    if (profile) {
      setRole(profile.targetRole || ''); setLevel(profile.targetLevel || '');
      setMonths(profile.actualExperienceMonths || 0); setCompanies((profile.targetCompanies || []).join(', '));
      setIndustries((profile.industries || []).join(', ')); setPlan(profile.dailyPlan || []);
      setFocus((profile.preferences?.focusTopics || []).join(', '));
      setAvoid((profile.preferences?.excludedTopics || []).join(', ')); setDifficulty(profile.preferences?.difficulty || 'mixed');
    }
  }
  useEffect(()=> {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    load().catch(e=>setMessage(e.response?.data?.error?.message || 'Could not load profile'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user,isLoading]);
  async function act(action:()=>Promise<void>) {
    setBusy(true);setMessage('');
    try { await action(); } catch(e:any) { setMessage(e.response?.data?.error?.message || 'Request failed; check your configuration and retry.'); }
    finally { setBusy(false); }
  }
  function updateEntry(kind:string,index:number,patch:any) {
    setReviewed(false);
    setFacts((previous:any)=>({...previous,[kind]:previous[kind].map((item:any,i:number)=>i===index?{...item,...patch}:item)}));
  }
  async function upload(file:File) {
    await act(async()=>{
      const form = new FormData();form.append('file',file);
      const response = await api.post('/resume/upload',form);
      await api.post('/resume/parse/'+response.data.data.resumeVersion.id);
      await load();setReviewed(false);setMessage('Resume extracted. Nothing is trusted until you review and confirm it.');
    });
  }
  if (isLoading) return <p className="p-8">Loading…</p>;
  return <main className="max-w-4xl mx-auto p-6 space-y-8">
    <header><h1 className="text-3xl font-bold">Your personalized interview profile</h1>
      <p className="mt-2">Your resume is the starting point—not a verified record. Confirm only what you actually know or contributed.</p>
      <Link href="/dashboard" className="text-blue-700 underline">Dashboard</Link>
    </header>
    {message && <p role="status" className="rounded bg-blue-50 p-4">{message}</p>}
    <section className="rounded border p-5 space-y-3"><h2 className="text-xl font-semibold">1. Upload a resume</h2>
      <p>Text-based PDF or DOCX. Uploading again creates a version; old versions are retained until you delete your resume.</p>
      <input aria-label="Upload resume" type="file" accept=".pdf,.docx" disabled={busy}
        onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}} />
      <p className="text-sm text-gray-600">Without configured AI, local parsing extracts known skills and contact links only. Add missing skills, projects and work experience below.</p>
    </section>
    {facts && <section className="rounded border p-5 space-y-4"><h2 className="text-xl font-semibold">2. Review extracted facts</h2>
      <label className="block">Current role<input className={inputStyle} value={facts.currentRole || ''}
        onChange={e=>{setReviewed(false);setFacts({...facts,currentRole:e.target.value});}} /></label>
      <h3 className="font-semibold">Skills</h3>
      {facts.skills.map((skill:any,i:number)=><div key={i} className="flex flex-wrap gap-3 items-center">
        <input aria-label={'Skill '+(i+1)} className={inputStyle+' max-w-xs'} value={skill.name} onChange={e=>updateEntry('skills',i,{name:e.target.value})} />
        <label><input type="checkbox" checked={skill.isConfirmed && !skill.isRemoved} onChange={e=>updateEntry('skills',i,{isConfirmed:e.target.checked,isRemoved:false})} /> Confirm</label>
        <label><input type="checkbox" checked={skill.isRemoved} onChange={e=>updateEntry('skills',i,{isRemoved:e.target.checked,isConfirmed:false})} /> Reject</label>
      </div>)}
      <button className="underline text-blue-700" onClick={()=>{setReviewed(false);setFacts({...facts,skills:[...facts.skills,{name:'',category:'other',confidence:1,isConfirmed:false,isRemoved:false}]});}}>Add skill</button>
      {['experience','projects'].map(kind=><div key={kind} className="space-y-3">
        <h3 className="font-semibold">{kind === 'experience'?'Work experience':'Projects'}</h3>
        {facts[kind].map((item:any,i:number)=><div key={i} className="border rounded p-3 space-y-2">
          {kind === 'experience'?<><label className="block">Company<input className={inputStyle} value={item.company} onChange={e=>updateEntry(kind,i,{company:e.target.value})} /></label>
            <label className="block">Role<input className={inputStyle} value={item.role} onChange={e=>updateEntry(kind,i,{role:e.target.value})} /></label></>
            :<><label className="block">Project name<input className={inputStyle} value={item.name} onChange={e=>updateEntry(kind,i,{name:e.target.value})} /></label>
            <label className="block">Description<textarea className={inputStyle} value={item.description} onChange={e=>updateEntry(kind,i,{description:e.target.value})} /></label></>}
          <label className="block">Technologies / tools (comma-separated)<input className={inputStyle} value={(item.technologies || []).join(', ')} onChange={e=>updateEntry(kind,i,{technologies:list(e.target.value)})} /></label>
          <label className="block">Your contribution (one per line)<textarea className={inputStyle} value={(item.responsibilities || []).join('\n')} onChange={e=>updateEntry(kind,i,{responsibilities:e.target.value.split('\n').filter(Boolean)})} /></label>
          {(kind==='projects'?['architectureClaims','performanceClaims','securityClaims','metrics','technicalDecisions','features']:['achievements','technicalClaims']).map(field=><label key={field} className="block text-sm">{field.replace(/([A-Z])/g,' $1')} (one per line)
            <textarea className={inputStyle} value={(item[field] || []).join('\n')} onChange={e=>updateEntry(kind,i,{[field]:e.target.value.split('\n').filter(Boolean)})} />
          </label>)}
          <p className="text-sm">Other extracted claims: {JSON.stringify(kind==='projects'?{architecture:item.architectureClaims,performance:item.performanceClaims,security:item.securityClaims,metrics:item.metrics}:{achievements:item.achievements,claims:item.technicalClaims})}</p>
          <button className="underline text-blue-700" onClick={()=>updateEntry(kind,i,kind==='projects'?{architectureClaims:[],performanceClaims:[],securityClaims:[],metrics:[]}:{achievements:[],technicalClaims:[]})}>Remove these additional claims</button>
          <div className="flex gap-4"><label><input type="checkbox" checked={item.isConfirmed && !item.isRemoved} onChange={e=>updateEntry(kind,i,{isConfirmed:e.target.checked,isRemoved:false})} /> Confirm this edited entry and its claims</label>
            <label><input type="checkbox" checked={item.isRemoved || false} onChange={e=>updateEntry(kind,i,{isRemoved:e.target.checked,isConfirmed:false})} /> Reject entry</label></div>
        </div>)}
        <button className="underline text-blue-700" onClick={()=>{setReviewed(false);setFacts({...facts,[kind]:[...facts[kind],kind==='projects'
          ?{name:'',description:'',technologies:[],responsibilities:[],isConfirmed:false,isRemoved:false}
          :{company:'',role:'',technologies:[],responsibilities:[],isConfirmed:false,isRemoved:false}]});}}>Add {kind==='projects'?'project':'experience'}</button>
      </div>)}
      <button className={buttonStyle} disabled={busy} onClick={()=>act(async()=>{
        await api.put('/profile/review',{fullName:facts.fullName,currentRole:facts.currentRole,totalExperienceMonths:months,
          skills:facts.skills,experience:facts.experience,projects:facts.projects});
        setReviewed(true);setMessage('Review saved. Only confirmed entries will personalize questions.');
        if (!plan.length) setPlan([{title:'Professional practice',topic:facts.skills.find((s:any)=>s.isConfirmed&&!s.isRemoved)?.name || facts.currentRole || 'Professional experience',type:'technical',count:5}]);
      })}>Save reviewed facts</button>
    </section>}
    {facts && <section className="rounded border p-5 space-y-4"><h2 className="text-xl font-semibold">3. Goals and daily plan</h2>
      <label className="block">Target role (optional; blank uses your reviewed current role)<input className={inputStyle} value={role} onChange={e=>setRole(e.target.value)} /></label>
      <label className="block">Target interview level (your own wording)<input className={inputStyle} value={level} placeholder="e.g. Senior, Graduate, Manager" onChange={e=>setLevel(e.target.value)} /></label>
      <label className="block">Actual experience in months<input type="number" min="0" max="1200" className={inputStyle} value={months} onChange={e=>setMonths(Number(e.target.value))} /></label>
      <label className="block">Target companies (optional)<input className={inputStyle} value={companies} onChange={e=>setCompanies(e.target.value)} /></label>
      <label className="block">Industries (optional)<input className={inputStyle} value={industries} onChange={e=>setIndustries(e.target.value)} /></label>
      <label className="block">Focus areas (comma-separated)<input className={inputStyle} value={focus} onChange={e=>setFocus(e.target.value)} /></label>
      <label className="block">Topics to avoid<input className={inputStyle} value={avoid} onChange={e=>setAvoid(e.target.value)} /></label>
      <label className="block">Interview date (optional)<input className={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
      <label className="block">Difficulty<select className={inputStyle} value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{['easy','medium','hard','extra_hard','mixed'].map(v=><option key={v}>{v}</option>)}</select></label>
      <p>No category is mandatory. Add the practice categories and topics that fit your goals. Coding uses the curated bank.</p>
      {plan.map((section,i)=><div key={i} className="grid sm:grid-cols-4 gap-2">
        <input aria-label={'Category title '+(i+1)} className={inputStyle} value={section.title} onChange={e=>setPlan(plan.map((s,j)=>i===j?{...s,title:e.target.value}:s))} />
        <input aria-label={'Topic '+(i+1)} className={inputStyle} value={section.topic} onChange={e=>setPlan(plan.map((s,j)=>i===j?{...s,topic:e.target.value}:s))} />
        <select aria-label={'Category type '+(i+1)} className={inputStyle} value={section.type} onChange={e=>setPlan(plan.map((s,j)=>i===j?{...s,type:e.target.value}:s))}>{['technical','system_design','coding','project','behavioral','custom'].map(v=><option key={v}>{v}</option>)}</select>
        <input aria-label={'Question count '+(i+1)} className={inputStyle} type="number" min="0" max="20" value={section.count} onChange={e=>setPlan(plan.map((s,j)=>i===j?{...s,count:Number(e.target.value)}:s))} />
      </div>)}
      <button className="underline text-blue-700 block" onClick={()=>setPlan([...plan,{title:'',topic:'',type:'custom',count:1}])}>Add category (set count to 0 to disable)</button>
      <button className={buttonStyle} disabled={busy || !reviewed} onClick={()=>act(async()=>{
        await api.post('/profile/onboarding',{targetRole:role,targetLevel:level,actualExperienceMonths:months,
          targetCompanies:list(companies),industries:list(industries),focusTopics:list(focus),excludedTopics:list(avoid),
          difficulty,dailyPlan:plan,interviewDate:date?new Date(date+'T12:00:00Z').toISOString():undefined});
        setMessage('Profile and curriculum saved. Preparing your first session…');
        await api.post('/sessions/generate');router.push('/sessions/today');
      })}>{busy?'Working…':'Save profile and start practice'}</button>
    </section>}
  </main>;
}
