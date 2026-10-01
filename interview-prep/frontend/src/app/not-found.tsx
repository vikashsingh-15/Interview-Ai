import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-brand-background px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-brand-secondary">404</p>
        <h1 className="mt-4 text-2xl font-bold text-brand-primary">Page not found</h1>
        <p className="mt-2 text-brand-textSecondary">
          The page you are looking for does not exist or has moved. Head back to your dashboard to continue preparing.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/dashboard" className="inline-flex items-center px-5 py-2.5 rounded-lg bg-brand-secondary text-white text-sm font-medium hover:bg-brand-secondary/90 transition-colors">
            Go to dashboard
          </Link>
          <Link href="/" className="inline-flex items-center px-5 py-2.5 rounded-lg border border-brand-border text-sm font-medium text-brand-text hover:bg-brand-primary/5 transition-colors">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
