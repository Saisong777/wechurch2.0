// Stub file - Lovable has been replaced with Replit Auth
// This file provides a mock client for backward compatibility

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: string, _options?: any) => {
      // Redirect to Replit Auth login
      window.location.href = '/api/login';
      return { error: null, redirected: true };
    },
    getSession: async () => ({ session: null, error: null }),
    getUser: async () => ({ user: null, error: null }),
  },
};
