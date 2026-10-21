import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

/** Expo inlines EXPO_PUBLIC_* only when the property is read statically. */
function setting(fromEnv: string | undefined, fromExtra: string | undefined) {
  const env = typeof fromEnv === 'string' ? fromEnv.trim() : '';
  const embedded = typeof fromExtra === 'string' ? fromExtra.trim() : '';
  return env || embedded;
}

export const config = {
  supabaseUrl: setting(process.env.EXPO_PUBLIC_SUPABASE_URL, extra.EXPO_PUBLIC_SUPABASE_URL),
  supabaseKey: setting(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, extra.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  apiUrl: setting(process.env.EXPO_PUBLIC_API_URL, extra.EXPO_PUBLIC_API_URL).replace(/\/$/, ''),
};

export const isConfigured = () => Boolean(config.supabaseUrl && config.supabaseKey && config.apiUrl);

export function apiUrl(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiUrl}${p}`;
}
