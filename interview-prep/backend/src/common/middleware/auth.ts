import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import config from '../../config';
import { UnauthorizedError, ForbiddenError } from '../filters/error-filter';
import User from '../../modules/auth/user.model';
import { Session } from '../../modules/auth/index.model';

export interface AuthenticatedRequest extends Request {
  user?: { id:string; email:string; role?:string };
  authSession?: { id:string; createdAt:Date };
  requestId?:string;
}
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function createSession(userId:string,userAgent=''):Promise<string> {
  const token=randomBytes(32).toString('base64url');
  await Session.create({userId,token:hashToken(token),userAgent,expiresAt:new Date(Date.now()+config.auth.sessionDurationMs)});
  return token;
}
export async function authenticate(req:AuthenticatedRequest,res:Response,next:NextFunction) {
  try {
    const token=req.cookies?.[config.auth.cookieName];
    if(!token || typeof token!=='string' || token.length>512) throw new UnauthorizedError('Not authenticated');
    const session=await Session.findOne({token:hashToken(token),isActive:true,expiresAt:{$gt:new Date()}});
    if(!session) throw new UnauthorizedError('Session expired or revoked');
    const user=await User.findById(session.userId);
    if(!user || user.isAccountDeleted) throw new UnauthorizedError('Session expired or revoked');
    req.user={id:String(user._id),email:user.email,role:user.role || 'user'};
    req.authSession={id:String(session._id),createdAt:session.createdAt};
    next();
  } catch(error) { next(error); }
}
export async function optionalAuthenticate(req:AuthenticatedRequest,res:Response,next:NextFunction) {
  await authenticate(req,res,()=>next());
}
export function authorizeAdmin(req:AuthenticatedRequest,res:Response,next:NextFunction) {
  if(req.user?.role!=='admin') return next(new ForbiddenError('Administrator access required'));
  next();
}
