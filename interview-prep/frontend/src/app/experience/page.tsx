'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import api from '@/lib/api';

interface Experience {
  _id: string; company: string; role: string; startDate?: string; endDate?: string;
  currentRole: boolean; isConfirmed: boolean; technologies: string[];
  responsibilities: string[]; achievements: string[]; technicalClaims: string[];
}
const dateLabel = (date?: string) => date ? new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : 'Not specified';

export default function ExperiencePage() {
  const { user, isLoading } = useAuth();
  const [entries, setEntries] = useState<Experience[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    let active = true;
    setEntries(null); setError('');
    api.get('/topics/experience').then(res => { if (active) setEntries(res.data.data); })
      .catch(() => { if (active) setError('Could not load your work experience. Please try again.'); });
    return () => { active = false; };
  }, [user]);
  if (isLoading) return <div className="p-8">Loading…</div>;
  if (!user) return <div className="p-8"><Link href="/login">Sign in to see your work experience.</Link></div>;
  return <div className="min-h-screen bg-brand-background py-8 px-4"><div className="max-w-6xl mx-auto">
    <h1 className="text-2xl font-bold text-brand-primary">Your work experience</h1>
    <p className="my-4 text-brand-textSecondary">Prepare to explain your responsibilities, achievements and technical claims. Review and edit these facts in <Link href="/onboarding" className="text-brand-secondary underline">resume review</Link>.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {!entries && !error && <p>Loading experience…</p>}
    {entries?.length === 0 && <p>No experience yet. Add your actual work experience in resume review.</p>}
    <div className="grid gap-6 md:grid-cols-2">{entries?.map(e => <Card key={e._id}>
      <CardHeader><CardTitle>{e.company}</CardTitle><p>{e.role}</p><p className="text-sm text-brand-textSecondary">{dateLabel(e.startDate)} – {e.currentRole ? 'Present' : dateLabel(e.endDate)}</p></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">{e.technologies.map(t => <Badge key={t} variant="neutral">{t}</Badge>)}</div>
        {(['responsibilities', 'achievements', 'technicalClaims'] as const).map(field => e[field].length > 0 && <section key={field} className="mb-4">
          <h2 className="font-semibold text-brand-primary">{field === 'technicalClaims' ? 'Technical claims' : field === 'responsibilities' ? 'Responsibilities' : 'Achievements'}</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">{e[field].map((item, i) => <li key={i}>{item}</li>)}</ul>
        </section>)}
        {e.isConfirmed ? <Link href={`/practice/experience/${e._id}`} className="inline-block rounded-lg bg-brand-secondary px-4 py-2 text-white">Practice this experience</Link>
          : <Link href="/onboarding" className="text-brand-secondary underline">Confirm this experience before practicing</Link>}
      </CardContent>
    </Card>)}</div>
  </div></div>;
}
