import 'dotenv/config';

const required = (name: string): string => {
  const value = process.env[name];
  return value || '';
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  supabaseUrl: required('SUPABASE_URL'),
  supabasePublishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  cookieSecret: required('COOKIE_SECRET'),
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
};

export const isProduction = env.nodeEnv === 'production';

// Keep the function loadable when a Vercel environment variable is missing.
// The API can then return a useful JSON configuration error instead of making
// Vercel return its opaque HTML runtime-error page.
export const missingProductionEnv = isProduction
  ? ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'COOKIE_SECRET'].filter((name) => !process.env[name])
  : [];
