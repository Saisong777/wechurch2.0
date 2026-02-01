/**
 * Storage helper utilities
 * 
 * These functions help proxy storage URLs through Edge Functions
 * to hide the actual Supabase Storage backend URLs from end users,
 * improving security by not exposing the storage structure.
 */

type StorageBucket = 'message-cards' | 'avatars';

/**
 * Convert a storage path to a proxied URL that hides the actual Supabase Storage URL
 * 
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param mode - 'view' for inline display, 'download' to trigger download
 * @returns The proxied URL
 */
export const getProxiedStorageUrl = (
  bucket: StorageBucket,
  path: string,
  mode: 'view' | 'download' = 'view'
): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/download-image?bucket=${bucket}&path=${encodeURIComponent(path)}&mode=${mode}`;
};

/**
 * Get a proxied URL for message card images
 */
export const getMessageCardUrl = (imagePath: string, mode: 'view' | 'download' = 'view'): string => {
  return getProxiedStorageUrl('message-cards', imagePath, mode);
};

/**
 * Get a proxied URL for avatar images
 */
export const getAvatarUrl = (avatarPath: string): string => {
  return getProxiedStorageUrl('avatars', avatarPath, 'view');
};

/**
 * Check if a URL is a direct Supabase Storage URL that should be proxied
 */
export const isDirectStorageUrl = (url: string): boolean => {
  return url.includes('.supabase.co/storage/v1/object/');
};

/**
 * Convert a direct Supabase Storage URL to a proxied URL
 * This is useful for URLs that were previously stored directly in the database
 * 
 * @param url - The original URL (can be direct Supabase or already proxied)
 * @returns The proxied URL, or the original if it's not a direct storage URL
 */
export const convertToProxiedUrl = (url: string): string => {
  if (!url || !isDirectStorageUrl(url)) {
    return url;
  }

  try {
    const urlObj = new URL(url);
    // Extract bucket and path from URL like:
    // https://xxx.supabase.co/storage/v1/object/public/avatars/user-id/filename.jpg
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    
    if (pathMatch) {
      const [, bucket, path] = pathMatch;
      if (bucket === 'message-cards' || bucket === 'avatars') {
        return getProxiedStorageUrl(bucket as StorageBucket, path, 'view');
      }
    }
  } catch (e) {
    console.warn('Failed to convert storage URL:', e);
  }

  return url;
};
