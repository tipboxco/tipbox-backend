import { ErrorCode } from './error-codes.enum';

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
    traceId?: string;
    timestamp: string;
    path: string;
  };
}

export interface ErrorContext {
  traceId?: string;
  userId?: string;
  path?: string;
  method?: string;
  details?: unknown;
}

