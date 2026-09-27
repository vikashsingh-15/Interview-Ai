import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body, param, query, matchedData } from 'express-validator';
import { ValidationError } from '../filters/error-filter';

// Validation middleware factory
export function validate(...validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(v => v.run(req)));

    // Check for errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Format errors for response
      const formattedErrors: Record<string, string[]> = {};

      errors.array().forEach((error) => {
        const path = (error as any).path || '_';
        if (!formattedErrors[path]) {
          formattedErrors[path] = [];
        }
        formattedErrors[path].push(error.msg as string);
      });

      return next(new ValidationError('Validation failed', formattedErrors));
    }

    // Replace req.body with validated data
    req.body = matchedData(req, { includeOptionals: true }) as any;

    next();
  };
}

// Common validation chains
export const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .trim()
    .withMessage('Valid email is required')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
];

export const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .trim()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

export const verifyEmailValidation = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
    .isLength({ min: 10 })
    .withMessage('Invalid verification token'),
];

export const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 10 })
    .withMessage('Invalid reset token'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
    .withMessage('Passwords must match'),
];

export const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
];

export const answerValidation = [
  body('answer')
    .notEmpty()
    .withMessage('Answer is required')
    .isLength({ min: 10, max: 10000 })
    .withMessage('Answer must be between 10 and 10000 characters'),
];

export const uploadValidation = [
  body('fileType')
    .optional()
    .isIn(['pdf', 'docx'])
    .withMessage('File type must be pdf or docx'),
];

// Param validation
export const paramIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
];

// Query validation helpers
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
];

export const sortValidation = [
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'title', 'difficulty', 'score'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];
