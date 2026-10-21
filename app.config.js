const app = require('./app.json');

function setting(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = () => ({
  expo: {
    ...app.expo,
    extra: {
      ...(app.expo.extra || {}),
      EXPO_PUBLIC_SUPABASE_URL: setting('EXPO_PUBLIC_SUPABASE_URL'),
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: setting('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
      EXPO_PUBLIC_API_URL: setting('EXPO_PUBLIC_API_URL'),
    },
  },
});
