'use client';
import { useEffect,useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
type Feedback={_id:string;interviewId:string;turn:number;notes:string;createdAt:string};
export default function FeedbackReview() {
  const {isAuthenticated,isLoading}=useAuth();
  const [items,setItems]=useState<Feedback[] | null>(null),[error,setError]=useState('');
  useEffect(()=>{if(isAuthenticated)api.get('/admin/evaluation-feedback').then(res=>setItems(res.data.data)).catch(()=>setError('Feedback review is available to administrators.'));},[isAuthenticated]);
  return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Evaluation feedback</h1>
    {isLoading ? <p>Loading…</p> : !isAuthenticated ? <p>Sign in to review feedback.</p> : error ? <p role="alert">{error}</p> : !items ? <p>Loading…</p> : items.length===0 ? <p>No reports yet.</p> : items.map(item=><article className="rounded border p-4" key={item._id}><p>{item.notes}</p><p className="mt-2 text-sm">Interview {item.interviewId} · question {item.turn+1} · {new Date(item.createdAt).toLocaleString()}</p></article>)}
  </main>;
}
