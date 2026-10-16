import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/filters/error-filter';
import logger from '../../config/logger';

const router = Router();
const eventSchema = z.object({
  eventId: z.string().max(100).optional(),
  category: z.enum(['window_error', 'unhandled_rejection', 'console_error', 'react_error', 'api_failure', 'question_generation_failure']),
  operation: z.string().max(300).optional(),
  message: z.string().max(2000).optional(),
  stack: z.string().max(6000).optional(),
  filename: z.string().max(500).optional(),
  line: z.number().int().min(0).max(10_000_000).optional(),
  column: z.number().int().min(0).max(10_000_000).optional(),
  page: z.string().max(500).optional(),
  requestId: z.string().max(100).optional(),
  status: z.number().int().min(0).max(599).optional(),
  code: z.string().max(100).optional(),
});

function safeText(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.slice(0, max)
    .replace(/(authorization|access[_-]?token|refresh[_-]?token|api[_ -]?key|password|secret|cookie)\s*[:=]\s*(['"]?)[^\s,;&'"}]+/gi, '$1=[REDACTED]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1');
}

router.post('/', asyncHandler(async (req, res) => {
  const event = eventSchema.parse(req.body);
  let page: string | undefined;
  if (event.page) {
    try { page = new URL(event.page, 'https://local.invalid').pathname.slice(0, 300); } catch { page = undefined; }
  }
  logger.error('Frontend error captured', {
    module: 'frontend',
    eventId: event.eventId,
    category: event.category,
    operation: safeText(event.operation, 300),
    clientMessage: safeText(event.message, 2000),
    clientStack: safeText(event.stack, 6000),
    filename: safeText(event.filename, 500)?.replace(/[?#].*$/, ''),
    line: event.line,
    column: event.column,
    page,
    requestId: event.requestId || (req as any).requestId,
    status: event.status,
    code: event.code,
  });
  res.status(202).json({ success: true });
}));

export default router;
