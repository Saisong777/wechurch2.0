/**
 * Get the public base URL for the application.
 * Priority: 
 * 1. Environment variable VITE_PUBLIC_BASE_URL if set
 * 2. Published domain (wechurch.lovable.app) if on lovable.app preview
 * 3. Current origin as fallback
 */
export const getPublicBaseUrl = (): string => {
  // Use environment variable if explicitly set
  if (import.meta.env.VITE_PUBLIC_BASE_URL) {
    return import.meta.env.VITE_PUBLIC_BASE_URL;
  }
  
  // If we're on a preview/project URL, use the published domain
  const origin = window.location.origin;
  if (origin.includes('lovableproject.com') || origin.includes('-preview--')) {
    return 'https://wechurch.lovable.app';
  }
  
  return origin;
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
