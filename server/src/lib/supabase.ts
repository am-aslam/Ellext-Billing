import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const createSupabaseAdminClient = (): SupabaseClient => createClient(env.supabaseUrl, env.supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
export const createSupabaseServerClient = (accessToken: string): SupabaseClient => createClient(env.supabaseUrl, env.supabasePublishableKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
export const createSupabaseAuthClient = (): SupabaseClient => createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
