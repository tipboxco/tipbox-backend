import { z } from 'zod';
import { CommonSchemas } from '../../infrastructure/middleware/validation.middleware';

/**
 * Login request schema
 */
export const LoginSchema = z.object({
  email: CommonSchemas.email,
  password: z.string().min(1, 'Şifre alanı zorunludur'),
});

export type LoginRequest = z.infer<typeof LoginSchema>;

/**
 * Register request schema
 */
export const RegisterSchema = z.object({
  email: CommonSchemas.email,
  password: CommonSchemas.password,
  name: CommonSchemas.name,
});

export type RegisterRequest = z.infer<typeof RegisterSchema>;

/**
 * Forgot password request schema
 */
export const ForgotPasswordSchema = z.object({
  mail: CommonSchemas.email,
});

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordSchema>;

/**
 * Verify reset code request schema
 */
export const VerifyResetCodeSchema = z.object({
  mail: CommonSchemas.email,
  code: z.string().length(6, 'Doğrulama kodu 6 haneli olmalıdır'),
});

export type VerifyResetCodeRequest = z.infer<typeof VerifyResetCodeSchema>;

/**
 * Reset password request schema
 */
export const ResetPasswordSchema = z.object({
  email: CommonSchemas.email,
  password: CommonSchemas.password,
});

export type ResetPasswordRequest = z.infer<typeof ResetPasswordSchema>;

/**
 * Verify email request schema
 */
export const VerifyEmailSchema = z.object({
  code: z.string().length(6, 'Doğrulama kodu 6 haneli olmalıdır'),
  email: CommonSchemas.email,
});

export type VerifyEmailRequest = z.infer<typeof VerifyEmailSchema>;

/**
 * Resend verification code schema
 */
export const ResendVerificationSchema = z.object({
  email: CommonSchemas.email,
});

export type ResendVerificationRequest = z.infer<typeof ResendVerificationSchema>;

