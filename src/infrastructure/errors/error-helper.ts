/**
 * Error handling utilities
 * Type-safe error handling for catch blocks
 */

/**
 * Get error message from unknown error type
 * @param error - The error object
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return 'Unknown error occurred';
}

/**
 * Get error code from unknown error type
 * @param error - The error object
 * @returns Error code string or undefined
 */
export function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

/**
 * Check if error has a specific message
 * @param error - The error object
 * @param message - The message to check for
 * @returns True if error message matches
 */
export function hasErrorMessage(error: unknown, message: string): boolean {
  return getErrorMessage(error) === message;
}

/**
 * Check if error message contains a substring
 * @param error - The error object
 * @param substring - The substring to check for
 * @returns True if error message contains substring
 */
export function errorMessageIncludes(error: unknown, substring: string): boolean {
  return getErrorMessage(error).includes(substring);
}

/**
 * Type guard for Error instance
 * @param error - The error object
 * @returns True if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}


