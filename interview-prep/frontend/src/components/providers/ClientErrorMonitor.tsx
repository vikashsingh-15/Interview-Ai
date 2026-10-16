'use client';

import { useEffect } from 'react';
import { reportClientError, reportConsoleError } from '@/lib/client-error-reporting';

export function ClientErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError({
      category: 'window_error', message: event.message || event.error?.message || 'Uncaught browser error',
      stack: event.error?.stack, filename: event.filename, line: event.lineno, column: event.colno,
    });
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportClientError({ category: 'unhandled_rejection',
        message: reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? 'Unhandled promise rejection'),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };
    const originalError = console.error;
    const captureConsoleError = (...args: unknown[]) => {
      originalError.apply(console, args);
      reportConsoleError(args);
    };
    const bootMonitorInstalled = Boolean((window as any).__interviewPrepErrorBoot);
    if (!bootMonitorInstalled) {
      window.addEventListener('error', onError);
      window.addEventListener('unhandledrejection', onRejection);
    }
    console.error = captureConsoleError;
    return () => {
      if (!bootMonitorInstalled) {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
      }
      if (console.error === captureConsoleError) console.error = originalError;
    };
  }, []);
  return null;
}
