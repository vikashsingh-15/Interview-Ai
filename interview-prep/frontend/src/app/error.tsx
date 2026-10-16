'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-error-reporting';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError({ category: 'react_error', message: error.message, stack: error.stack, code: error.digest });
  }, [error]);

  return <main className="mx-auto max-w-xl p-8" role="alert">
    <h1 className="text-xl font-semibold">This page hit an error</h1>
    <p className="mt-2">The error was reported. Try loading the page again.</p>
    <button className="mt-4 rounded bg-blue-700 px-4 py-2 text-white" onClick={reset}>Try again</button>
  </main>;
}
