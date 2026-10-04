'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { PracticeScreen } from '@/components/features/PracticeScreen';
import api from '@/lib/api';

export default function SourcePracticePage() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const { user, isLoading } = useAuth();
  const [source, setSource] = useState<{ kind: 'project' | 'experience'; id: string; label: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    let active = true;
    setSource(null); setError('');
    api.get(`/topics/source/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`)
      .then(res => { if (active) setSource({ kind: res.data.data.kind, id: res.data.data.id, label: res.data.data.label }); })
      .catch(err => { if (active) setError(err.response?.data?.error?.message || 'Could not load this entry.'); });
    return () => { active = false; };
  }, [kind, id, user]);
  if (!isLoading && !user) return <div className="p-8"><Link href="/login">Sign in to practice your work.</Link></div>;
  if (error) return <div className="p-8 text-red-600" role="alert">{error}</div>;
  if (!source) return <div className="p-8">Loading practice…</div>;
  return <PracticeScreen key={`${user?.id}:${kind}:${id}`} source={source} />;
}
