/**
 * Get the public base URL for the application.
 * Priority: 
 * 1. Environment variable VITE_PUBLIC_BASE_URL if set
 * 2. Current origin as fallback
 */
export const getPublicBaseUrl = (): string => {
  if (import.meta.env.VITE_PUBLIC_BASE_URL) {
    return import.meta.env.VITE_PUBLIC_BASE_URL;
  }
  
  return window.location.origin;
};

/**
 * Generate a join URL for a session using short code.
 */
export const getSessionJoinUrl = (sessionIdOrShortCode: string): string => {
  return `${getPublicBaseUrl()}/user/study?session=${sessionIdOrShortCode}`;
};

/**
 * Check if a string looks like a short code (4 alphanumeric chars) vs UUID
 */
export const isShortCode = (input: string): boolean => {
  return /^[A-Z0-9]{4}$/i.test(input.trim());
};
