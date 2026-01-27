/**
 * Get the public base URL for the application.
 * Falls back to window.location.origin for local development or if not configured.
 */
export const getPublicBaseUrl = (): string => {
  // Use environment variable if set, otherwise use current origin
  return import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
};

/**
 * Generate a join URL for a session using short code.
 */
export const getSessionJoinUrl = (sessionIdOrShortCode: string): string => {
  return `${getPublicBaseUrl()}/user?session=${sessionIdOrShortCode}`;
};

/**
 * Check if a string looks like a short code (4 alphanumeric chars) vs UUID
 */
export const isShortCode = (input: string): boolean => {
  return /^[A-Z0-9]{4}$/i.test(input.trim());
};
