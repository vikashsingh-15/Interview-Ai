import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import config from '../../config';
import { asyncHandler, ForbiddenError } from '../../common/filters/error-filter';
import { googleAuth } from './google.service';
import { authService } from './auth.service';
import { authRateLimiter } from '../../common/middleware/rate-limit';
const router=Router();
const cookieOptions={httpOnly:true,secure:config.auth.cookieSecure,sameSite:config.auth.cookieSameSite,path:'/'} as const;
router.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
router.get('/providers',(_req,res)=>res.json({success:true,data:{google:googleAuth.configured()}}));
router.get('/google',authRateLimiter,asyncHandler(async(_req,res)=>{
  const flow=await googleAuth.begin();
  res.cookie('oauth_state',flow.state,{...cookieOptions,maxAge:600000});res.redirect(flow.url);
}));
router.get('/google/link',authRateLimiter,authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const flow=await googleAuth.begin(req.user!.id);
  res.cookie('oauth_state',flow.state,{...cookieOptions,maxAge:600000});res.redirect(flow.url);
}));
router.get('/google/callback',authRateLimiter,asyncHandler(async(req,res)=>{
  try {
    const {sessionToken}=await googleAuth.callback(String(req.query.code || ''),String(req.query.state || ''),
      req.cookies?.oauth_state || '',req.headers['user-agent'] || '');
    res.cookie(config.auth.cookieName,sessionToken,{...cookieOptions,maxAge:config.auth.sessionDurationMs});
    res.clearCookie('oauth_state',cookieOptions);
    res.clearCookie('interview_prep_refresh',cookieOptions);
    res.redirect(config.urls.frontend+'/dashboard');
  } catch {
    res.clearCookie('oauth_state',cookieOptions);
    res.redirect(config.urls.frontend+'/login?error=google_login_failed');
  }
}));
router.post('/logout',asyncHandler(async(req,res)=>{
  await authService.logout(req.cookies?.[config.auth.cookieName] || '');
  res.clearCookie(config.auth.cookieName,cookieOptions);res.clearCookie('oauth_state',cookieOptions);
  res.json({success:true,message:'Signed out'});
}));
router.get('/me',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
  res.json({success:true,data:await authService.getProfile(req.user!.id)});
}));
const preferences=z.object({
  dailyQuestions:z.number().int().min(0).max(50).optional(),codingCount:z.number().int().min(0).max(10).optional(),
  systemDesignCount:z.number().int().min(0).max(10).optional(),projectQuestions:z.number().int().min(0).max(20).optional(),
  studyDays:z.number().int().min(1).max(365).optional(),focusTopics:z.array(z.string().max(100)).max(30).optional(),
  excludedTopics:z.array(z.string().max(100)).max(30).optional(),revisionFrequency:z.enum(['daily','weekly','biweekly']).optional(),
  mockInterviewDuration:z.number().int().min(10).max(180).optional(),notifyBrowser:z.boolean().optional(),
});
router.put('/me',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const data=z.object({name:z.string().trim().min(2).max(100).optional(),preferences:preferences.optional()}).parse(req.body);
  res.json({success:true,data:await authService.updateProfile(req.user!.id,data)});
}));
router.delete('/me',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
  z.object({confirmation:z.literal('DELETE')}).parse(req.body);
  if(!req.authSession || Date.now()-new Date(req.authSession.createdAt).getTime()>10*60000)
    throw new ForbiddenError('Sign in with Google again before deleting your account');
  const result=await authService.deleteAccount(req.user!.id);
  res.clearCookie(config.auth.cookieName,cookieOptions);res.json(result);
}));
export default router;
