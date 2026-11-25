'use client';
import { useEffect,useState } from 'react';
import api from '@/lib/api';
type Row={_id:string;count:number;average:number;recent:{score:number;date:string}[]};
export function TopicAnalytics() {
  const [rows,setRows]=useState<Row[] | null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{api.get('/analytics/topics').then(r=>setRows(r.data.data)).catch(()=>setFailed(true));},[]);
  return <section className="my-6 rounded border p-5"><h2 className="text-lg font-semibold">Practice by topic</h2>
    <p className="text-sm">Scores are coaching estimates, not a prediction of interview performance.</p>
    {failed ? <p>Could not load topic progress.</p> : !rows ? <p>Loading progress…</p> : rows.length===0 ? <p>No evaluated answers yet.</p> : rows.map(row=><div key={row._id} className="mt-3 border-t pt-3"><strong>{row._id || 'Other'}</strong> · {row.count} evaluated answer{row.count===1?'':'s'} · average {Math.round(row.average*100)}%<p className="text-sm">Recent: {row.recent.map(item=>`${Math.round(item.score*100)}% (${new Date(item.date).toLocaleDateString()})`).join(', ')}</p>{row.count<3 && <p className="text-sm">Limited evidence so far.</p>}</div>)}
  </section>;
}
