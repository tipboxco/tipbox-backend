/**
 * Query parameter parsing utilities
 * Type-safe query parameter parsing for Express routes
 */

/**
 * Parse a query parameter as an integer
 * @param value - The query parameter value
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed integer or default value
 */
export function parseQueryInt(value: unknown, defaultValue: number): number {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }
  if (typeof value === 'number') {
    return value;
  }
  return defaultValue;
}

/**
 * Parse a query parameter as a string
 * @param value - The query parameter value
 * @returns Trimmed string or undefined if empty/invalid
 */
export function parseQueryString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return undefined;
}

/**
 * Parse a query parameter as a boolean
 * @param value - The query parameter value
 * @returns Boolean value
 */
export function parseQueryBoolean(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return Boolean(value);
}

/**
 * Parse a query parameter as an array of strings
 * @param value - The query parameter value
 * @returns Array of strings or empty array
 */
export function parseQueryStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}






