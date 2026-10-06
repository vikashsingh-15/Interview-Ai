import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped correlation context. Every log line emitted while a request
 * is in flight automatically carries requestId/method/route/userId, so a
 * frontend error (which only knows its X-Request-ID) can be matched to the
 * exact Render log entry without threading parameters through every call site.
 */
export interface LogContext {
  requestId?: string;
  method?: string;
      route?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<LogContext>();

/** Enter the correlation context for a whole middleware/handler chain. */
export function runWithRequestContext<T>(context: LogContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): LogContext | undefined {
  return storage.getStore();
}

/**
 * Merge fields into the active context (e.g. auth middleware learning the
 * userId after the request started). No-op outside a request.
 */
export function updateRequestContext(patch: Partial<LogContext>): void {
  const store = storage.getStore();
  if (store) Object.assign(store, patch);
}
