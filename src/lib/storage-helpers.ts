/**
 * Storage helper utilities for local file storage
 */

/**
 * Get URL for message card images stored in public folder
 */
export const getMessageCardUrl = (imagePath: string, mode: 'view' | 'download' = 'view'): string => {
  // Return Express API URL for message card images
  return `/api/message-cards/image/${imagePath}`;
};

/**
 * Get URL for avatar images
 */
export const getAvatarUrl = (avatarPath: string): string => {
  // Handle legacy Supabase URLs or return local path
  if (avatarPath.includes('supabase.co')) {
    return avatarPath;
  }
  return `/avatars/${avatarPath}`;
};

/**
 * Convert a URL - handles legacy Supabase URLs for backwards compatibility
 * For local storage, just returns the URL as-is
 */
export const convertToProxiedUrl = (url: string): string => {
  // For legacy Supabase URLs, return as-is (they still work)
  // For local URLs, just return them
  return url || '';
};
