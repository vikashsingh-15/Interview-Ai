'use client';

import Link from 'next/link';

export function SignInPrompt({ pageName, returnTo, isLoading = false }: { pageName: string; returnTo: string; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-brand-background" role="status" aria-label="Checking your sign-in">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-secondary" />
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-brand-background px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-brand-border bg-brand-surface p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-brand-primary">Sign in to continue</h1>
        <p className="mt-3 text-brand-textSecondary">Sign in to access {pageName} and your personal interview preparation workspace.</p>
        <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-secondary px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-secondary/90 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2">
          Sign in
        </Link>
      </section>
    </main>
  );
}
