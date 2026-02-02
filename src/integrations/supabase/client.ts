// Stub file - Supabase has been replaced with Replit Auth
// This file provides a mock client for backward compatibility

const mockAuth = {
  getSession: async () => ({ data: { session: null }, error: null }),
  getUser: async () => ({ data: { user: null }, error: null }),
  signUp: async () => { window.location.href = '/api/login'; return { data: null, error: null }; },
  signInWithPassword: async () => { window.location.href = '/api/login'; return { data: null, error: null }; },
  signOut: async () => { window.location.href = '/api/logout'; return { error: null }; },
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  updateUser: async () => ({ data: null, error: null }),
  resetPasswordForEmail: async () => ({ data: null, error: null }),
};

const mockStorage = {
  from: () => ({
    upload: async () => ({ data: null, error: null }),
    download: async () => ({ data: null, error: null }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
  }),
};

const mockFunctions = {
  invoke: async () => ({ data: null, error: null }),
};

export const supabase = {
  auth: mockAuth,
  storage: mockStorage,
  functions: mockFunctions,
  from: (table: string) => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
    update: () => ({ data: null, error: null }),
    delete: () => ({ data: null, error: null }),
    upsert: () => ({ data: null, error: null }),
    eq: () => ({ data: [], error: null }),
    single: () => ({ data: null, error: null }),
  }),
  channel: () => ({
    on: () => ({ subscribe: () => {} }),
  }),
  removeChannel: () => {},
};
