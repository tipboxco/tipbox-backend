import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ErrorCode } from '../errors/error-codes.enum';
import logger from '../logger/logger';

/**
 * Request body validation middleware
 * @param schema - Zod validation schema
 * @returns Express middleware
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate and sanitize request body
      const validated = schema.parse(req.body);
      
      // Replace request body with validated data
      req.body = validated;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format validation errors
        const errors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        logger.warn('Validation failed', {
          path: req.path,
          method: req.method,
          errors,
        });
        
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Validation failed',
            details: errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }
      
      // Unexpected error
      logger.error('Unexpected validation error', { error });
      next(error);
    }
  };
};

/**
 * Request query params validation middleware
 * @param schema - Zod validation schema
 * @returns Express middleware
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Query validation failed',
            details: errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Request params validation middleware
 * @param schema - Zod validation schema
 * @returns Express middleware
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Params validation failed',
            details: errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // ID validation (ULID format)
  id: z.string().length(26, 'ID must be 26 characters (ULID format)'),
  
  // Email validation
  email: z.string().email('Geçerli bir email adresi giriniz'),
  
  // Password validation
  password: z.string()
    .min(8, 'Şifre en az 8 karakter olmalıdır')
    .max(100, 'Şifre en fazla 100 karakter olabilir'),
  
  // Name validation
  name: z.string()
    .min(2, 'İsim en az 2 karakter olmalıdır')
    .max(50, 'İsim en fazla 50 karakter olabilir')
    .trim(),
  
  // Bio validation
  bio: z.string()
    .max(500, 'Bio en fazla 500 karakter olabilir')
    .trim()
    .optional(),
  
  // URL validation
  url: z.string().url('Geçerli bir URL giriniz').optional(),
  
  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
};

