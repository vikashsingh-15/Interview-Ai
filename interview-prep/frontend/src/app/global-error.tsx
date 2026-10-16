'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-error-reporting';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError({ category: 'react_error', message: error.message, stack: error.stack, code: error.digest });
  }, [error]);

  return <html lang="en"><body>
    <main role="alert" style={{ fontFamily: 'sans-serif', margin: '4rem auto', maxWidth: 600, padding: '1rem' }}>
      <h1>Application error</h1>
      <p>The error was reported. Try again or reload the page.</p>
      <button onClick={reset}>Try again</button>
    </main>
  </body></html>;
}
