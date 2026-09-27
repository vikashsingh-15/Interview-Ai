import { Request } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config';
import logger from '../../config/logger';
import User from './user.model';
import { Session } from './index.model';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../../common/middleware/auth';
import { UnauthorizedError, ForbiddenError, ConflictError, InternalError } from '../../common/filters/error-filter';
import { sendEmail } from './email.service';

// Auth service
export const authService = {
  // Register new user
  async register(email: string, password: string, name: string) {
    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      isEmailVerified: config.features.emailVerification ? false : true,
    });

    // Generate email verification token if needed
    let verificationToken: string | undefined;
    let verificationExpires: Date | undefined;

    if (config.features.emailVerification) {
      verificationToken = uuidv4();
      verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await User.findByIdAndUpdate(user._id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      });
    }

    logger.info('User registered', { userId: user._id, email });

    // Send verification email if needed
    if (verificationToken && config.email.provider !== 'ethereal') {
      await sendEmail({
        to: email,
        subject: 'Verify your email - Interview Prep',
        content: `
          <h1>Email Verification</h1>
          <p>Welcome to Interview Prep!</p>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="${config.urls.frontend}/verify-email?token=${verificationToken}">
            Verify Email
          </a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        `,
      });
    }

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      isEmailVerified: user.isEmailVerified,
      requiresVerification: config.features.emailVerification && !user.isEmailVerified,
    };
  },

  // Login user
  async login(email: string, password: string, req?: Request) {
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .lean();

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account is deleted
    if (user.isAccountDeleted) {
      throw new ForbiddenError('Account has been deleted');
    }

    // Check email verification
    if (config.features.emailVerification && !user.isEmailVerified) {
      throw new UnauthorizedError('Email not verified. Please verify your email first.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateToken(user._id.toString(), user.email);
    const refreshToken = generateRefreshToken(user._id.toString(), user.email);

    // Store session
    await Session.create({
      userId: user._id,
      token: accessToken,
      refreshToken: refreshToken,
      deviceInfo: req?.headers['user-agent'] || 'Unknown',
      ipAddress: req?.ip || req?.socket?.remoteAddress || 'Unknown',
      userAgent: req?.headers['user-agent'] || 'Unknown',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    logger.info('User logged in', { userId: user._id, email });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    };
  },

  // Logout user
  async logout(token: string) {
    // Delete session by token or user's sessions
    await Session.deleteOne({ token });

    logger.info('User logged out', { token: token.substring(0, 20) + '...' });
  },

  // Refresh token
  async refresh(refreshToken: string) {
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Check if session exists
    const session = await Session.findOne({
      userId: payload.userId,
      refreshToken,
      isActive: true,
    });

    if (!session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Get user
    const user = await User.findById(payload.userId).select('+passwordHash');

    if (!user || user.isAccountDeleted) {
      throw new UnauthorizedError('User not found or account deleted');
    }

    // Generate new tokens
    const newAccessToken = generateToken(user._id.toString(), user.email);
    const newRefreshToken = generateRefreshToken(user._id.toString(), user.email);

    // Update session
    await Session.findByIdAndUpdate(session._id, {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      lastUsedAt: new Date(),
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  // Verify email
  async verifyEmail(token: string) {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logger.info('Email verified', { userId: user._id });

    return {
      success: true,
      message: 'Email verified successfully',
    };
  },

  // Request password reset
  async requestPasswordReset(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists
      return { success: true };
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    });

    // Send reset email
    await sendEmail({
      to: email,
      subject: 'Reset your password - Interview Prep',
      content: `
        <h1>Password Reset</h1>
        <p>You requested a password reset for your Interview Prep account.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${config.urls.frontend}/reset-password?token=${resetToken}">
          Reset Password
        </a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this reset, please ignore this email. Your password will remain unchanged.</p>
      `,
    });

    logger.info('Password reset requested', { userId: user._id, email });

    return { success: true };
  },

  // Reset password
  async resetPassword(token: string, newPassword: string) {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordHash');

    if (!user) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);

    // Update password
    user.passwordHash = passwordHash;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info('Password reset', { userId: user._id });

    return {
      success: true,
      message: 'Password reset successfully',
    };
  },

  // Update profile
  async updateProfile(userId: string, updates: Partial<{ name: string; preferences: any }>) {
    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Update allowed fields
    if (updates.name !== undefined) {
      user.name = updates.name;
    }

    if (updates.preferences !== undefined) {
      user.preferences = { ...user.preferences, ...updates.preferences };
    }

    await user.save();

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      preferences: user.preferences,
    };
  },

  // Delete account
  async deleteAccount(userId: string, password: string) {
    const user = await User.findById(userId).select('+passwordHash');

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid password');
    }

    // Soft delete
    user.isAccountDeleted = true;
    user.accountDeletedAt = new Date();
    await user.save();

    // Delete all sessions
    await Session.deleteMany({ userId });

    // Delete all user data (in production, you might want to anonymize instead)
    // This would require cascading deletes which should be handled carefully

    logger.info('Account deleted', { userId: user._id });

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  },

  // Get user profile
  async getProfile(userId: string) {
    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      preferences: user.preferences,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  },

  // Change password
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findById(userId).select('+passwordHash');

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Check if new password is same as old
    if (newPassword === currentPassword) {
      throw new ConflictError('New password must be different from current password');
    }

    // Hash and update password
    user.passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
    await user.save();

    logger.info('Password changed', { userId: user._id });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  },

  // Check if email exists (for duplicate checking during registration)
  async checkEmailExists(email: string): Promise<boolean> {
    const user = await User.findOne({ email: email.toLowerCase() });
    return !!user;
  },
};
