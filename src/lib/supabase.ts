import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isConfigured } from './config';
import { secureStorage } from './secure';

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!isConfigured()) throw new Error('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
