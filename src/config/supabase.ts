/**
 * Supabase client configuration
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create client even if env vars are missing (will fail gracefully when used)
// This prevents the app from crashing on load
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

// Export a helper to check if config is valid
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'https://placeholder.supabase.co');
};
