import { Router } from 'express';
import { AuthenticatedRequest } from '../../common/middleware/auth';
import config from '../../config';
import { validate, registerValidation, loginValidation, verifyEmailValidation, resetPasswordValidation } from '../../common/middleware/validate';
import { authService } from './auth.service';
import { asyncHandler } from '../../common/filters/error-filter';

const router = Router();

// Register
router.post(
  '/register',
  validate(...registerValidation),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    const result = await authService.register(email, password, name);

    res.status(201).json({
      success: true,
      data: result,
      message: result.requiresVerification
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful. Welcome!',
    });
  })
);

// Login
router.post(
  '/login',
  validate(...loginValidation),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const result = await authService.login(email, password, req);

    res.cookie('interview_prep_session', result.accessToken, {
      httpOnly: true,
      secure: config.auth.cookieSecure,
      sameSite: config.auth.cookieSameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      data: {
        user: result.user,
      },
    });
  })
);

// Logout
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.interview_prep_session || '';

    await authService.logout(token);

    res.clearCookie('interview_prep_session');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

// Refresh token
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    const result = await authService.refresh(refreshToken);

    res.cookie('interview_prep_session', result.accessToken, {
      httpOnly: true,
      secure: config.auth.cookieSecure,
      sameSite: config.auth.cookieSameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  })
);

// Verify email
router.post(
  '/verify-email',
  validate(...verifyEmailValidation),
  asyncHandler(async (req, res) => {
    const { token } = req.body;

    const result = await authService.verifyEmail(token);

    res.json({
      success: true,
      message: result.message,
    });
  })
);

// Request password reset
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    await authService.requestPasswordReset(email);

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.',
    });
  })
);

// Reset password
router.post(
  '/reset-password',
  validate(...resetPasswordValidation),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    await authService.resetPassword(token, password);

    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  })
);

// Get profile
router.get(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const profile = await authService.getProfile(req.user.id);

    res.json({
      success: true,
      data: profile,
    });
  })
);

// Update profile
router.put(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { name, preferences } = req.body;

    const result = await authService.updateProfile(req.user.id, { name, preferences });

    res.json({
      success: true,
      data: result,
    });
  })
);

// Change password
router.post(
  '/change-password',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { currentPassword, newPassword } = req.body;

    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.json({
      success: true,
      message: result.message,
    });
  })
);

// Delete account
router.delete(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { password } = req.body;

    const result = await authService.deleteAccount(req.user.id, password);

    // Clear cookie
    res.clearCookie('interview_prep_session');

    res.json({
      success: true,
      message: result.message,
    });
  })
);

export default router;
