import 'dotenv/config';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') throw new Error(`${name} is required in production`);
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
