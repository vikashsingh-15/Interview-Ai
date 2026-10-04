import { Request, Response } from 'express';
import logger from '../../config/logger';

export function notFoundHandler(req: Request, res: Response) {
  const requestId = (req as any).requestId || 'unknown';

  logger.warn('Route not found', {
    requestId,
    url: req.originalUrl,
    method: req.method,
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
