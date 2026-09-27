import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../../config';
import logger from '../../config/logger';
import { UnauthorizedError, ForbiddenError } from '../filters/error-filter';
import User from '../../modules/auth/user.model';

// JWT payload type
export interface JwtPayload {
  userId: string;
  email: string;
  type?: string;
  exp: number;
  iat: number;
}

// Extended request with user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  requestId?: string;
}

// Authentication middleware
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies?.[config.auth.cookieName] ||
      (req.headers.authorization?.startsWith('Bearer ') ?
        req.headers.authorization.slice(7) :
        null);

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Verify token
    const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;

    // Check if user exists and is not deleted
    const user = User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Check if account is deleted
    if ((user as any).isAccountDeleted) {
      throw new UnauthorizedError('Account has been deleted');
    }

    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', { error: err.message });
      next(new UnauthorizedError('Invalid token'));
    } else if (err instanceof jwt.TokenExpiredError) {
      logger.warn('Token expired', { error: err.message });
      next(new UnauthorizedError('Token expired'));
    } else {
      next(err);
    }
  }
}

// Optional authentication (doesn't fail if no token)
export function optionalAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.[config.auth.cookieName] ||
      (req.headers.authorization?.startsWith('Bearer ') ?
        req.headers.authorization.slice(7) :
        null);

    if (token) {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;

      const user = User.findById(decoded.userId).select('-passwordHash');
      if (user && !((user as any).isAccountDeleted)) {
        req.user = {
          id: decoded.userId,
          email: decoded.email,
        };
      }
    }
  } catch {
    // Silently ignore auth errors for optional
  }

  next();
}

// Admin authorization middleware (for future use)
export function authorizeAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Check if user has admin role
  // For now, just pass through - implement role-based access later
  next();
}

// Generate JWT token
export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    {
      userId,
      email,
    },
    config.auth.jwtSecret,
    {
      expiresIn: config.auth.jwtExpiresIn as any,
    }
  );
}

// Generate refresh token
export function generateRefreshToken(userId: string, email: string): string {
  return jwt.sign(
    {
      userId,
      email,
      type: 'refresh',
    },
    config.auth.jwtSecret,
    {
      expiresIn: config.auth.jwtRefreshExpiresIn as any,
    }
  );
}

// Verify refresh token
export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload & { type?: string };

  if (decoded.type !== 'refresh') {
    throw new UnauthorizedError('Invalid refresh token');
  }

  return decoded;
}

// Verify access token
export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;

  if (decoded.type === 'refresh') {
    throw new UnauthorizedError('Use refresh token for refresh requests');
  }

  return decoded;
}
