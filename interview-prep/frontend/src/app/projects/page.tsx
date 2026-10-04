'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';

interface PrepProject {
  _id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  role?: string;
  isCurrent?: boolean;
  technologies?: string[];
  startDate?: string;
  endDate?: string;
  keyDesignDecisions?: string[];
}

interface ExperienceEntry {
  _id: string;
  company: string;
  role?: string;
  currentRole?: boolean;
  isConfirmed?: boolean;
  technologies?: string[];
  responsibilities?: string[];
  achievements?: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  personal: 'Personal', work: 'Work', open_source: 'Open source',
  academic: 'Academic', freelance: 'Freelance', startup: 'Startup', other: 'Other',
};

export default function ProjectsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<PrepProject[] | null>(null);
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    Promise.all([
      api.get('/projects'),
      api.get('/topics/experience').catch(() => ({ data: { data: [] } })),
    ])
      .then(([projectRes, experienceRes]) => {
        setProjects(Array.isArray(projectRes.data.data) ? projectRes.data.data : []);
        setExperiences(Array.isArray(experienceRes.data.data) ? experienceRes.data.data : []);
      })
      .catch(() => setFailed(true));
  }, [authLoading, isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-background px-4">
        <Card className="max-w-md"><CardContent className="p-8 text-center">
          <p className="text-brand-textSecondary">Sign in to see your resume projects and prepare to defend them in interviews.</p>
          <Link href="/login" className="mt-4 inline-block text-brand-secondary hover:underline">Sign in</Link>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-background py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-brand-primary mb-1">Your projects</h1>
        <p className="text-brand-textSecondary mb-6">
          Resume projects the interviewer can ask about. Confirm and edit them during onboarding; practice defending each one in a mock interview.
        </p>

        {failed && (
          <Card className="mb-6"><CardContent className="p-5 text-sm text-red-600">
            Could not load your projects. Check that the backend is running, then refresh.
          </CardContent></Card>
        )}

        {projects && projects.length === 0 && (
          <Card><CardContent className="p-10 text-center">
            <p className="text-brand-textSecondary">
              No projects yet. Upload a resume in onboarding and confirm your projects to build this list.
            </p>
            <Link href="/onboarding" className="mt-4 inline-block">
              <Button>Go to onboarding</Button>
            </Link>
          </CardContent></Card>
        )}

        {projects && projects.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((p) => (
              <Card key={p._id} className="card-hover">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg leading-snug">{p.name}</CardTitle>
                    <Badge variant={p.status === 'active' ? 'primary' : p.status === 'completed' ? 'success' : 'neutral'}>
                      {p.isCurrent ? 'current' : (p.status || 'project').replace('_', ' ')}
                    </Badge>
                  </div>
                  {p.role && <p className="text-sm text-brand-textSecondary">Role: {p.role}</p>}
                </CardHeader>
                <CardContent>
                  {p.description && (
                    <p className="text-sm text-brand-text leading-relaxed line-clamp-4 mb-4">{p.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {p.category && <Badge variant="neutral">{CATEGORY_LABELS[p.category] || p.category}</Badge>}
                    {(p.technologies ?? []).slice(0, 8).map((tech) => (
                      <span key={tech} className="text-xs px-2 py-0.5 rounded-full bg-brand-background text-brand-textSecondary">{tech}</span>
                    ))}
                    {(p.technologies?.length ?? 0) > 8 && (
                      <span className="text-xs text-brand-textSecondary">+{p.technologies!.length - 8} more</span>
                    )}
                  </div>
                  {(p.keyDesignDecisions?.length ?? 0) > 0 && (
                    <p className="text-xs text-brand-textSecondary mb-4">
                      {p.keyDesignDecisions!.length} key design decision{p.keyDesignDecisions!.length === 1 ? '' : 's'} recorded
                    </p>
                  )}
                  <Link href={`/practice/project/${p._id}`}>
                    <Button variant="secondary" className="w-full">Practice this project</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <section className="mt-10" aria-labelledby="experience-heading">
          <h2 id="experience-heading" className="text-xl font-bold text-brand-primary mb-1">Professional experience</h2>
          <p className="text-brand-textSecondary mb-5">
            Practice the real work recorded in your resume alongside your projects.
          </p>
          {experiences.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-brand-textSecondary">
              No confirmed experience entries yet. Confirm them during onboarding to practice them here.
            </CardContent></Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {experiences.map((entry) => (
                <Card key={entry._id} className="card-hover">
                  <CardHeader>
                    <CardTitle className="text-lg">{entry.company}</CardTitle>
                    {entry.role && <p className="text-sm text-brand-textSecondary">{entry.role}{entry.currentRole ? ' · Current' : ''}</p>}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(entry.technologies ?? []).slice(0, 8).map((tech) => <Badge key={tech} variant="neutral">{tech}</Badge>)}
                    </div>
                    {(entry.responsibilities?.[0] || entry.achievements?.[0]) && (
                      <p className="text-sm text-brand-text line-clamp-3 mb-4">{entry.responsibilities?.[0] || entry.achievements?.[0]}</p>
                    )}
                    <Link href={`/practice/experience/${entry._id}`}>
                      <Button variant="secondary" className="w-full">Practice this experience</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
