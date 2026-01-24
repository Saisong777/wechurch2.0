/**
 * Get the public base URL for the application.
 * Falls back to window.location.origin for local development or if not configured.
 */
export const getPublicBaseUrl = (): string => {
  // Use environment variable if set, otherwise use current origin
  return import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
};

/**
 * Generate a join URL for a session.
 */
export const getSessionJoinUrl = (sessionId: string): string => {
  return `${getPublicBaseUrl()}/user?session_id=${sessionId}`;
};
