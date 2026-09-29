import { Request, Response, NextFunction } from 'express';
import logger from '../../config/logger';

// API Error class
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ValidationError class
export class ValidationError extends ApiError {
  errors?: Record<string, any>;

  constructor(message: string, errors?: Record<string, any>) {
    super(400, message, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

// UnauthorizedError class
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

// ForbiddenError class
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

// NotFoundError class
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

// ConflictError class
export class ConflictError extends ApiError {
  constructor(message: string = 'Conflict') {
    super(409, message, 'CONFLICT');
  }
}

// RateLimitError class
export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests') {
    super(429, message, 'RATE_LIMIT');
  }
}

// BadRequestError class
export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request') {
    super(400, message, 'BAD_REQUEST');
  }
}

// InternalError class
export class InternalError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(500, message, 'INTERNAL_ERROR', false);
  }
}

// AI Provider Error
export class AIProviderError extends ApiError {
  constructor(
    message: string,
    public provider: string,
    public originalError?: Error
  ) {
    super(503, message, 'AI_PROVIDER_ERROR');
  }
}

// Error handling middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = (req as any).requestId || 'unknown';

  // Default error
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let isOperational = false;
  let errors: Record<string, any> | undefined;

  // Handle known API errors
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || 'INTERNAL_ERROR';
    isOperational = err.isOperational;
    errors = (err as any).errors;
  }
  else if ((err as any).name === 'ZodError') {
    statusCode = 400;
    message = 'Invalid request data';
    code = 'VALIDATION_ERROR';
    isOperational = true;
  }
  // Handle JSON parsing errors
  else if (err instanceof SyntaxError && (err as any).body) {
    statusCode = 400;
    message = 'Invalid JSON body';
    code = 'INVALID_JSON';
    isOperational = true;
  }
  // Handle Mongoose validation errors
  else if ((err as any).name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    isOperational = true;
    errors = (err as any).errors;
  }
  // Handle Mongoose duplicate key errors
  else if ((err as any).code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
    code = 'DUPLICATE_ENTRY';
    isOperational = true;
    const field = Object.keys((err as any).keyValue || {})[0];
    errors = { [field || 'field']: 'Already exists' };
  }
  // Handle Mongoose cast errors
  else if ((err as any).name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
    isOperational = true;
  }

  // Log error
  if (statusCode >= 500) {
    logger.error('Server error', {
      requestId,
      error: err.message,
      stack: err.stack,
      url: req.path,
      method: req.method,
    });
  } else {
    logger.warn('Client error', {
      requestId,
      error: err.message,
      code,
      url: req.path,
      method: req.method,
    });
  }

  // Security: Don't expose internal errors in production
  if (config.isProduction && !isOperational) {
    message = 'An unexpected error occurred';
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(errors && { errors }),
      ...(config.isDevelopment && { stack: err.stack }),
    },
    requestId,
    timestamp: new Date().toISOString(),
  });
}

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Import config for production check
import config from '../../config';
