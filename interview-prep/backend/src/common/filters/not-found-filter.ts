import { Request, Response } from 'express';
import logger from '../../config/logger';

export function notFoundHandler(req: Request, res: Response) {
  const requestId = (req as any).requestId || 'unknown';
  // Never log the query string; it can carry OAuth codes, states or tokens.
  const path = (req.originalUrl || req.path).split('?')[0];
  logger.warn('Route not found', {
    module: 'http',
    route: path,
    method: req.method,
    requestId,
    userId: (req as any).userId || undefined,
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
    requestId,
    timestamp: new Date().toISOString(),
  });
}
