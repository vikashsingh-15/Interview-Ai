import winston from 'winston';
import { getRequestContext } from '../common/logging/request-context';
import { looksSecretKey, scrubCredentials } from '../common/logging/redact';

const level = process.env.LOG_LEVEL || 'info';
const formatName = (process.env.LOG_FORMAT || 'text').toLowerCase();

// Render captures stdout/stderr line by line, so the default format is one
// readable line per event: [LEVEL] [timestamp] [module] [route] message key=value…
// Stack traces print on the following lines for unexpected errors. LOG_FORMAT=json
// restores machine-parseable records for log pipelines.
const reservedKeys = new Set(['level', 'timestamp', 'message', 'module', 'route', 'stack', 'service', 'requestId', 'method', 'userId']);

// Merge the request-scoped correlation context (explicit fields win), then mask
// any field whose name looks like a credential. Defense in depth: a call site
// that forgets to redact still cannot write a secret to the log stream.
const withContext = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx) {
    if (info.requestId === undefined && ctx.requestId !== undefined) info.requestId = ctx.requestId;
    if (info.method === undefined && ctx.method !== undefined) info.method = ctx.method;
    if (info.route === undefined && ctx.route !== undefined) info.route = ctx.route;
    if (info.userId === undefined && ctx.userId !== undefined) info.userId = ctx.userId;
  }
  for (const key of Object.keys(info)) {
    if (reservedKeys.has(key)) continue;
    const value = (info as Record<string, unknown>)[key];
    if (looksSecretKey.test(key)) (info as Record<string, unknown>)[key] = '[REDACTED]';
    else if (typeof value === 'string') (info as Record<string, unknown>)[key] = scrubCredentials(value);
  }
  return info;
})();

const textFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  withContext,
  winston.format.printf((info) => {
    const module = typeof info.module === 'string' ? info.module : 'app';
    const routeBits: string[] = [];
    if (typeof info.method === 'string') routeBits.push(info.method);
    if (typeof info.route === 'string') routeBits.push(info.route);
    const route = routeBits.join(' ') || '-';
    const parts: string[] = [`[${String(info.level).toUpperCase()}]`, `[${info.timestamp}]`, `[${module}]`, `[${route}]`, scrubCredentials(String(info.message))];
    for (const [key, value] of Object.entries(info)) {
      if (reservedKeys.has(key) || value === undefined || value === null) continue;
      if (key === 'error' && value instanceof Error) { parts.push(`error=${JSON.stringify(value.message)}`); continue; }
      parts.push(`${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`);
    }
    if (info.requestId !== undefined) parts.push(`requestId=${info.requestId}`);
    if (info.userId !== undefined) parts.push(`userId=${info.userId}`);
    let line = parts.join(' ');
    // Inline stacks stay readable without breaking the one-line-per-event shape.
    if (typeof info.stack === 'string' && info.stack.length) line += `\n${scrubCredentials(info.stack)}`;
    return line;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  withContext,
  winston.format.json()
);

// Create logger. Process-level crash handlers live in index.ts so exceptions
// are logged once (not by both the transport and a process handler).
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL === 'debug' ? 'debug' : level,
  format: formatName === 'json' ? jsonFormat : textFormat,
  defaultMeta: { service: 'interview-prep-backend' },
  exitOnError: false,
  transports: [new winston.transports.Console()],
});

// Export logger
export default logger;

// Re-export winston types
export { winston };
