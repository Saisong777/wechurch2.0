/**
 * Storage helper utilities for local file storage
 */

/**
 * Get URL for message card images stored in public folder
 */
export const getMessageCardUrl = (imagePath: string, mode: 'view' | 'download' = 'view'): string => {
  if (!imagePath) return '';
  
  // Handle full URLs
  if (imagePath.startsWith('http')) {
    // Check if it's a wechurch.replit.app URL (migrated data with incorrect path)
    // Extract filename and use our API which handles fallback to Supabase
    if (imagePath.includes('wechurch.replit.app/message-cards/')) {
      const filename = imagePath.split('/').pop();
      if (filename) {
        return `/api/message-cards/image/${filename}`;
      }
    }
    // For actual Supabase URLs or other external URLs, return as-is
    return imagePath;
  }
  
  // If it's just a filename (newly uploaded or migrated filename), use our API
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
