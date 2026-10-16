export type ClientErrorCategory = 'window_error' | 'unhandled_rejection' | 'console_error' | 'react_error' | 'api_failure' | 'question_generation_failure';

export interface ClientErrorEvent {
  category: ClientErrorCategory;
  operation?: string;
  message?: string;
  stack?: string;
  filename?: string;
  line?: number;
  column?: number;
  requestId?: string;
  status?: number;
  code?: string;
}

const recent = new Map<string, number>();
let windowStarted = Date.now();
let eventCount = 0;

function trimText(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

function safeConsoleValue(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return value === null ? 'null' : `[${typeof value}]`;
}

export function reportClientError(input: ClientErrorEvent): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - windowStarted >= 60_000) { windowStarted = now; eventCount = 0; }
  if (eventCount >= 20) return;
  const page = window.location.pathname;
  const message = trimText(input.message, 2000);
  const fingerprint = `${input.category}|${input.operation || ''}|${page}|${message || ''}`;
  const previous = recent.get(fingerprint);
  if (previous && now - previous < 60_000) return;
  recent.set(fingerprint, now);
  if (recent.size > 100) recent.clear();
  eventCount += 1;

  const event = {
    ...input,
    eventId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`,
    message,
    stack: trimText(input.stack, 6000),
    operation: trimText(input.operation, 300),
    filename: trimText(input.filename, 500),
    page,
  };
  try {
    const body = JSON.stringify(event);
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon || !navigator.sendBeacon('/api/client-errors', blob)) {
      void fetch('/api/client-errors', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
    }
  } catch {
    // Reporting must never cause or amplify an application error.
  }
}

export function reportConsoleError(args: unknown[]): void {
  if (typeof args[0] === 'string' && /^\[(API_FAILURE|QUESTION_GENERATION_FAILURE)\]/.test(args[0])) return;
  const message = args.map(safeConsoleValue).join(' ').slice(0, 2000);
  const firstError = args.find(value => value instanceof Error) as Error | undefined;
  reportClientError({ category: 'console_error', message, stack: firstError?.stack });
}
