import config from '../../config';
import logger from '../../config/logger';

// Email options
export interface EmailOptions {
  to: string;
  subject: string;
  content: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

// Email sending function (simplified - use actual email provider in production)
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, content, from = config.email.from } = options;

  logger.info('Email sent (simulated)', {
    to,
    subject,
    from,
  });

  // In development, just log
  if (config.email.provider === 'ethereal' || config.isDevelopment) {
    logger.info('Email preview:', { content: content.substring(0, 500) });
    return;
  }

  // In production, use actual email provider
  // Example with SendGrid:
  /*
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(config.email.sendgridApiKey);
  await sgMail.send({
    to,
    from,
    subject,
    html: content,
    attachments: options.attachments,
  });
  */

  // Example with Nodemailer:
  /*
  const transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
      user: 'apikey',
      pass: config.email.sendgridApiKey,
    },
  });
  await transporter.sendMail({
    from,
    to,
    subject,
    html: content,
    attachments: options.attachments,
  });
  */
}

// Send verification email
export async function sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Verify your email - Interview Prep',
    content: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="color: #2c3e50;">Interview Prep</h1>
            <p>Hi there,</p>
            <p>Welcome to Interview Prep! Please verify your email address to get started.</p>
            <p><a href="${config.urls.frontend}/verify-email?token=${verificationToken}" class="button">
              Verify Email Address
            </a></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <div class="footer">
              <p>This email was sent by Interview Prep.</p>
              <p>You're receiving this because you signed up for Interview Prep.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Reset your password - Interview Prep',
    content: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 4px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="color: #2c3e50;">Interview Prep</h1>
            <p>Hi there,</p>
            <p>You requested a password reset for your Interview Prep account.</p>
            <p>Click the button below to reset your password:</p>
            <p><a href="${config.urls.frontend}/reset-password?token=${resetToken}" class="button">
              Reset Password
            </a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, your password will remain unchanged.</p>
            <div class="footer">
              <p>This email was sent by Interview Prep.</p>
              <p>If you have any questions, please contact support.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}

// Send welcome email after onboarding completion
export async function sendWelcomeEmail(email: string, userName: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Welcome to Interview Prep!',
    content: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .highlight { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="color: #2c3e50;">Welcome to Interview Prep, ${userName}!</h1>
            <p>Congratulations on completing your onboarding!</p>
            <div class="highlight">
              <p><strong>Your personalized interview preparation is ready!</strong></p>
              <p>Day 1 is available and contains:</p>
              <ul>
                <li>Technical questions tailored to your profile</li>
                <li>System design questions</li>
                <li>Coding problems</li>
                <li>Project interview questions</li>
                <li>Revisions (if any)</li>
              </ul>
            </div>
            <p>You can access your dashboard at:</p>
            <p><a href="${config.urls.frontend}/dashboard">Go to Dashboard</a></p>
            <p>Good luck with your interview preparation!</p>
            <div class="footer">
              <p>This email was sent by Interview Prep.</p>
              <p>If you have any questions, please contact support.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}

// Send session reminder
export async function sendSessionReminder(email: string, userName: string, dayNumber: number): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Day ${dayNumber} session is ready - Interview Prep`,
    content: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="color: #2c3e50;">Day ${dayNumber} is ready, ${userName}!</h1>
            <p>Your interview preparation session for today is ready.</p>
            <p>Keep up the great work! Your consistent practice will help you ace your interviews.</p>
            <p><a href="${config.urls.frontend}/sessions/today" class="button">
              Start Today's Session
            </a></p>
            <div class="footer">
              <p>This email was sent by Interview Prep.</p>
              <p>You can unsubscribe from notifications in your account settings.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}

// Send revision reminder
export async function sendRevisionReminder(email: string, userName: string, revisionCount: number): Promise<void> {
  await sendEmail({
    to: email,
    subject: `${revisionCount} revisions due - Interview Prep`,
    content: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="color: #2c3e50;">${revisionCount} revisions due, ${userName}!</h1>
            <p>You have ${revisionCount} questions waiting for review today.</p>
            <p>Spaced repetition helps solidify your knowledge for the interview.</p>
            <p><a href="${config.urls.frontend}/revisions" class="button">
              Complete Revisions
            </a></p>
            <div class="footer">
              <p>This email was sent by Interview Prep.</p>
              <p>Keep crushing it!</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}
