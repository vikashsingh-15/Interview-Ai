'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/providers/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-brand-background" role="status" aria-label="Checking your sign-in"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-secondary" /></main>;
  }

  return <main className="max-w-md mx-auto p-8 space-y-5"><h1 className="text-2xl font-bold">Sign in with Google</h1><LoginForm /></main>;
}
