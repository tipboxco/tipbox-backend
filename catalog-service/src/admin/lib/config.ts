/**
 * Returns the backend base URL from Medusa's __BACKEND_URL__ global.
 * Falls back to empty string (relative paths) if not set.
 */
export const backendUrl: string =
  typeof __BACKEND_URL__ !== "undefined" ? __BACKEND_URL__ : ""
