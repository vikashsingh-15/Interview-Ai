/**
 * Log-safety helpers. Anything derived from a connection string or an
 * external payload must pass through here before it reaches a log line, so
 * credentials and secrets never end up in Render's log stream.
 */

/**
 * A log-safe target for a database URI: `protocol//host[:port]` without
 * userinfo or query options. Plain `new URL()` throws on MongoDB
 * comma-separated replica-set hosts, so credentials are stripped at the string
 * level first and the query string is dropped entirely.
 */
export function safeDbTarget(uri: string): string {
  const withoutCredentials = uri.replace(/^([a-z+]+:\/\/)[^/]*@/i, '$1').split('?')[0];
  try {
    const parsed = new URL(withoutCredentials);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return withoutCredentials;
  }
}

export const looksSecretKey = /password|passwd|token|verifier|cookie|secret|authorization|api[-_ ]?key|credential/i;

const URI_CREDENTIALS = /(\/\/)[^@\s/]+@/g;

/**
 * Mask `user:password@` credentials anywhere inside a text value. Driver and
 * provider error messages occasionally echo the connection string they were
 * given, so every string that reaches a log line passes through here.
 */
export function scrubCredentials(value: string): string {
  return value.replace(URI_CREDENTIALS, '$1');
}

/** Recursively replace secret-looking object values with `[REDACTED]`. */
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as unknown as T;
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (looksSecretKey.test(key)) out[key] = '[REDACTED]';
    else out[key] = redactSecrets(item);
  }
  return out as unknown as T;
}
