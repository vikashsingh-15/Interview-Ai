import { Writable } from 'stream';
import logger, { winston } from '../../src/config/logger';
import { runWithRequestContext, updateRequestContext } from '../../src/common/logging/request-context';
import { runJob } from '../../src/common/logging/job';
import { safeDbTarget, redactSecrets, scrubCredentials } from '../../src/common/logging/redact';
import { errorHandler, ValidationError, UnauthorizedError } from '../../src/common/filters/error-filter';
import { notFoundHandler } from '../../src/common/filters/not-found-filter';
import { structuredAIMeta, AIUsage, AIRequest } from '../../src/common/services/structured-ai';
import { withAIFallback } from '../../src/common/services/ai-provider';
import config from '../../src/config';
import { z } from 'zod';

jest.mock('../../src/common/services/ai-provider', () => ({
  ...jest.requireActual('../../src/common/services/ai-provider'),
  hasAnyAI: () => true,
  withAIFallback: jest.fn(),
}));

// Capture exactly what Render would see: the same formatted records the console
// transport receives, without touching process.stdout.
const captured: string[] = [];
const sink = new Writable({
  write(chunk: Buffer, _encoding, callback) { captured.push(String(chunk)); callback(); },
});
logger.add(new winston.transports.Stream({ stream: sink }));

const lines = () => captured.join('').split(/\r?\n/).filter(Boolean);
const flush = () => new Promise((resolve) => setImmediate(resolve));

function mockRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  return res;
}
function mockReq(overrides: Record<string, unknown> = {}) {
  const routePath = typeof overrides.path === 'string' ? overrides.path : '/api/x';
  return { method: 'GET', path: routePath, originalUrl: routePath, headers: {}, ...overrides } as any;
}

beforeEach(() => { captured.length = 0; });

describe('log format', () => {
  test('one readable line per event with level, timestamp, module, route and correlation id', async () => {
    logger.warn('Route not found', { module: 'http', route: '/api/missing', method: 'GET', requestId: 'req-123' });
    await flush();

    expect(lines()[0]).toMatch(
      /^\[WARN\] \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[http\] \[GET \/api\/missing\] Route not found .*requestId=req-123$/,
    );
  });

  test('severity is user readable across levels', async () => {
    logger.info('informational', { module: 'db' });
    logger.warn('warning', { module: 'db' });
    logger.error('failure', { module: 'db' });
    await flush();

    expect(lines().map((line) => line.slice(0, 7))).toEqual(['[INFO] ', '[WARN] ', '[ERROR]']);
  });

  test('unexpected errors print their stack on the following lines', async () => {
    logger.error('Server error', { module: 'http', requestId: 'req-stack', stack: new Error('boom').stack });
    await flush();

    const printed = lines();
    expect(printed[0]).toContain('[ERROR]');
    expect(printed[0]).toContain('requestId=req-stack');
    expect(printed.slice(1).join('\n')).toContain('Error: boom');
  });
});

describe('request correlation', () => {
  test('AsyncLocalStorage context is merged into every line during a request', async () => {
    runWithRequestContext(
      { requestId: 'ctx-1', method: 'POST', route: '/api/planner/tasks', userId: 'user-1' },
      () => { logger.info('Inside handler'); },
    );
    await flush();

    const line = lines()[0];
    expect(line).toContain('[POST /api/planner/tasks]');
    expect(line).toContain('requestId=ctx-1');
    expect(line).toContain('userId=user-1');
  });

  test('context grows with the user id once authentication succeeds', async () => {
    runWithRequestContext({ requestId: 'ctx-2' }, () => {
      updateRequestContext({ userId: 'user-2' });
      logger.info('After auth');
    });
    await flush();

    expect(lines()[0]).toContain('requestId=ctx-2');
    expect(lines()[0]).toContain('userId=user-2');
  });
});

describe('secret safety', () => {
  test('secret-looking fields are redacted even when a call site forgets', async () => {
    logger.error('Auth failed', {
      module: 'auth', password: 'hunter2', accessToken: 'tok-123', apiKey: 'key-abc', requestId: 'req-secret',
    });
    await flush();

    const output = captured.join('');
    expect(output).not.toContain('hunter2');
    expect(output).not.toContain('tok-123');
    expect(output).not.toContain('key-abc');
    expect(output).toContain('password=[REDACTED]');
  });

  test('connection strings are reduced to a host target', () => {
    const atlas = 'mongodb://appuser:sup3rsecret@ac-shard-00.mongodb.net:27017,ac-shard-01.mongodb.net:27017/app?replicaSet=atlas&authSource=admin';
    const printed = safeDbTarget(atlas);

    expect(printed).not.toContain('appuser');
    expect(printed).not.toContain('sup3rsecret');
    expect(printed).not.toContain('?');
    expect(printed).toContain('ac-shard-00.mongodb.net:27017');
    expect(safeDbTarget('mongodb://localhost:27017/app')).toBe('mongodb://localhost:27017');
    expect(safeDbTarget('mongodb+srv://u:p%40ss@cluster0.abcde.mongodb.net/db?retryWrites=true')).toBe('mongodb+srv://cluster0.abcde.mongodb.net');
  });

  test('credentials echoed inside a message are masked', async () => {
    logger.error('MongoParseError: mongodb://appuser:sup3rsecret@cluster0.example.net/app failed', { module: 'db' });
    await flush();

    const output = captured.join('');
    expect(output).not.toContain('appuser');
    expect(output).not.toContain('sup3rsecret');
    expect(output).toContain('mongodb://cluster0.example.net/app');
  });

  test('scrubCredentials removes userinfo from any URI-shaped text', () => {
    expect(scrubCredentials('failed to reach mongodb://u:p%40ss@host:27017/db')).toBe('failed to reach mongodb://host:27017/db');
    expect(scrubCredentials('no credentials here')).toBe('no credentials here');
  });

  test('redactSecrets masks nested secret keys', () => {
    expect(redactSecrets({ user: 'a', password: 'p', nested: { apiKey: 'k', keep: 'v' }, list: [{ token: 't' }] }))
      .toEqual({ user: 'a', password: '[REDACTED]', nested: { apiKey: '[REDACTED]', keep: 'v' }, list: [{ token: '[REDACTED]' }] });
  });
});

describe('job lifecycle', () => {
  test('runJob reports start and success with a duration', async () => {
    const result = await runJob('calendar-backfill', { userId: 'u1' }, async () => 42);
    await flush();

    expect(result).toBe(42);
    const printed = lines();
    expect(printed[0]).toContain('[INFO]');
    expect(printed[0]).toContain('[job]');
    expect(printed[0]).toContain('Job started');
    expect(printed[0]).toContain('job=calendar-backfill');
    expect(printed[0]).toContain('userId=u1');
    expect(printed[1]).toContain('Job succeeded');
    expect(printed[1]).toMatch(/durationMs=\d+/);
  });

  test('runJob reports the failure with a stack and rethrows to preserve control flow', async () => {
    await expect(runJob('resume-parse', { userId: 'u1' }, async () => { throw new Error('parse exploded'); }))
      .rejects.toThrow('parse exploded');
    await flush();

    const printed = lines();
    expect(printed[0]).toContain('Job started');
    expect(printed[1]).toContain('[ERROR]');
    expect(printed[1]).toContain('[job]');
    expect(printed[1]).toContain('Job failed');
    expect(printed[1]).toContain('error=parse exploded');
    expect(printed.slice(1).join('\n')).toContain('Error: parse exploded');
  });
});

describe('external AI provider failures', () => {
  test('a provider rejection is logged with status, request id and a redacted body', async () => {
    jest.spyOn(AIUsage, 'updateOne').mockResolvedValue({} as any);
    jest.spyOn(AIUsage, 'findOneAndUpdate').mockResolvedValue({ requests: 1 } as any);
    jest.spyOn(AIRequest, 'create').mockResolvedValue({ _id: 'ai-req-1' } as any);
    jest.spyOn(AIRequest, 'updateOne').mockResolvedValue({} as any);

    const providerError: any = new Error('insufficient user quota');
    providerError.status = 403;
    providerError.request_id = 'prov-req-9';
    providerError.body = { code: 'insufficient_user_quota', api_key: 'sk-secret-value' };
    (withAIFallback as unknown as jest.Mock).mockRejectedValueOnce(providerError);

    await expect(structuredAIMeta({
      userId: 'u1', purpose: 'resume-extraction', version: 'v1', system: 'extract',
      context: { resumeText: 'text' }, schema: z.object({ ok: z.boolean() }),
    })).rejects.toThrow('insufficient user quota');
    await flush();

    const output = captured.join('');
    expect(output).toContain('[WARN]');
    expect(output).toContain('[ai]');
    expect(output).toContain('AI request failed');
    expect(output).toContain('status=403');
    expect(output).toContain('aiRequestId=ai-req-1');
    expect(output).toContain('insufficient_user_quota');
    expect(output).not.toContain('sk-secret-value');
  });

  test('an operator-supplied provider request id is still surfaced for support', async () => {
    jest.spyOn(AIUsage, 'updateOne').mockResolvedValue({} as any);
    jest.spyOn(AIUsage, 'findOneAndUpdate').mockResolvedValue({ requests: 1 } as any);
    jest.spyOn(AIRequest, 'create').mockResolvedValue({ _id: 'ai-req-2' } as any);
    jest.spyOn(AIRequest, 'updateOne').mockResolvedValue({} as any);

    const providerError: any = new Error('provider unavailable');
    providerError.status = 503;
    providerError.request_id = 'prov-req-11';
    (withAIFallback as unknown as jest.Mock).mockRejectedValueOnce(providerError);

    await expect(structuredAIMeta({
      userId: 'u1', purpose: 'question-generation', version: 'v1', system: 'generate',
      context: { topic: 'Redis' }, schema: z.object({ ok: z.boolean() }),
    })).rejects.toThrow('provider unavailable');
    await flush();

    expect(captured.join('')).toContain('requestId=prov-req-11');
  });
});

describe('HTTP failure logging', () => {
  test('unexpected 500s log module/route/requestId with a stack but never leak it in the response', async () => {
    const original = config.isProduction;
    (config as any).isProduction = true;
    try {
      const req = mockReq({ method: 'POST', path: '/api/planner/tasks', requestId: 'req-500' });
      const res = mockRes();
      errorHandler(new Error('db connection lost'), req, res, (() => {}) as any);
      await flush();

      const output = captured.join('');
      expect(output).toContain('[ERROR]');
      expect(output).toContain('[http]');
      expect(output).toContain('[POST /api/planner/tasks]');
      expect(output).toContain('requestId=req-500');
      expect(output).toContain('db connection lost');
      expect(output).toContain('Error: db connection lost');
      expect(res.statusCode).toBe(500);
      expect(res.body.error.message).toBe('An unexpected error occurred');
      expect(res.body.error.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('db connection lost');
    } finally {
      (config as any).isProduction = original;
    }
  });

  test('operational 400s log a WARN with the code and no stack', async () => {
    const req = mockReq({ method: 'POST', path: '/api/auth/login', requestId: 'req-400' });
    const res = mockRes();
    errorHandler(new ValidationError('Email is required'), req, res, (() => {}) as any);
    await flush();

    const printed = lines();
    expect(printed[0]).toContain('[WARN]');
    expect(printed[0]).toContain('[POST /api/auth/login]');
    expect(printed[0]).toContain('code=VALIDATION_ERROR');
    expect(printed.length).toBe(1);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Email is required');
  });

  test('unauthenticated requests log a WARN for the route', async () => {
    const req = mockReq({ method: 'GET', path: '/api/tracker/tasks', requestId: 'req-401' });
    const res = mockRes();
    errorHandler(new UnauthorizedError('Not authenticated'), req, res, (() => {}) as any);
    await flush();

    expect(lines()[0]).toContain('[WARN]');
    expect(lines()[0]).toContain('[GET /api/tracker/tasks]');
    expect(lines()[0]).toContain('code=UNAUTHORIZED');
    expect(res.statusCode).toBe(401);
  });

  test('database failures are flagged so they are identifiable in production', async () => {
    // The driver reports MongoServerSelectionError at runtime; mongoose errors
    // use the Mongoose prefix. Both must be flagged.
    for (const name of ['MongoServerSelectionError', 'MongooseServerSelectionError']) {
      captured.length = 0;
      const err: any = new Error('connection timed out');
      err.name = name;
      errorHandler(err, mockReq({ method: 'GET', path: '/api/tracker/tasks', requestId: 'req-db' }), mockRes(), (() => {}) as any);
      await flush();

      const output = captured.join('');
      expect(output).toContain('db=true');
      expect(output).toContain('dbMessage=connection timed out');
    }
  });

  test('unknown routes log a WARN with the requested url and correlation id', async () => {
    notFoundHandler(mockReq({ method: 'GET', originalUrl: '/api/definitely-missing', requestId: 'req-404' }), mockRes());
    await flush();

    const line = lines()[0];
    expect(line).toContain('[WARN]');
    expect(line).toContain('[GET /api/definitely-missing]');
    expect(line).toContain('requestId=req-404');
  });
});
