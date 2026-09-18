import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createSupabaseAdminClient, createSupabaseAuthClient } from '../lib/supabase.js';
import { env } from '../config/env.js';
import { hashToken, maskEmail, randomToken } from '../lib/crypto.js';
import { requireAuth, sessionCookie } from '../middleware/auth.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const otpLimiter = rateLimit({ windowMs: 60 * 1000, limit: 1, standardHeaders: true, legacyHeaders: false });
const email = z.string().trim().toLowerCase().email().max(320);
const password = z.string().min(8).max(128);
const code = z.string().regex(/^\d{6}$/);
const genericLoginError = 'Unable to sign in with those credentials.';
const signupErrorResponse = (error: { message?: string; status?: number } | null | undefined): { status: number; message: string } => {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('already') || message.includes('registered') || message.includes('exists')) return { status: 409, message: 'An account with this email already exists. Please sign in instead.' };
  if (message.includes('invalid') && message.includes('email')) return { status: 400, message: 'Enter a valid email address.' };
  if (message.includes('password')) return { status: 400, message: 'Choose a stronger password. Avoid common or previously leaked passwords.' };
  if ((message.includes('signup') || message.includes('email')) && message.includes('disabled')) return { status: 503, message: 'Account creation is disabled in Supabase. Enable the Email provider and Email signups in the Supabase Auth settings.' };
  const safeDetail = String(error?.message || '').replace(/[^A-Za-z0-9 .,:'_-]/g, '').trim().slice(0, 140);
  return { status: 503, message: safeDetail ? `Supabase rejected account creation: ${safeDetail}` : 'Supabase rejected the account creation request. Check the Supabase Auth Email provider configuration.' };
};
const audit = async (admin: ReturnType<typeof createSupabaseAdminClient>, values: Record<string, unknown>): Promise<void> => { await admin.from('audit_logs').insert(values); };
const createApplicationSession = async (admin: ReturnType<typeof createSupabaseAdminClient>, userId: string, req: Request, res: Response): Promise<void> => {
  const raw = randomToken();
  const { error } = await admin.from('sessions').insert({ user_id: userId, session_token_hash: hashToken(raw), expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), ip_address: req.ip, user_agent: req.get('user-agent') });
  if (error) throw error;
  await audit(admin, { user_id: userId, action: 'LOGIN', entity: 'USER', entity_id: userId, ip_address: req.ip });
  sessionCookie(res, raw, 8 * 60 * 60 * 1000);
};

router.post('/signup', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ name: z.string().trim().min(2).max(120), email, password, confirmPassword: password }).safeParse(req.body);
  if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword || !/[A-Z]/.test(parsed.data.password) || !/[a-z]/.test(parsed.data.password) || !/\d/.test(parsed.data.password) || !/[^A-Za-z0-9]/.test(parsed.data.password)) { res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Use a valid name, email, and password with upper, lower, number, and special character.' } }); return; }
  try {
    const admin = createSupabaseAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true, user_metadata: { full_name: parsed.data.name } });
    if (error || !created.user) { console.error('auth signup rejected', { status: error?.status, message: error?.message }); const detail = signupErrorResponse(error); res.status(detail.status).json({ success: false, error: { code: 'SIGNUP_FAILED', message: detail.message } }); return; }
    const { error: profileError } = await admin.from('profiles').insert({ id: created.user.id, email: parsed.data.email, full_name: parsed.data.name, role: 'STAFF', status: 'ACTIVE', email_verified: true });
    if (profileError) { await admin.auth.admin.deleteUser(created.user.id); throw profileError; }
    await audit(admin, { user_id: created.user.id, action: 'SIGNUP', entity: 'USER', entity_id: created.user.id, ip_address: req.ip }); res.status(201).json({ success: true, data: { requiresLogin: true, message: 'Account created. Sign in with your email and password.' } });
  } catch (error) { console.error('auth signup failed', error); res.status(503).json({ success: false, error: { code: 'AUTH_UNAVAILABLE', message: 'We could not create the account. Check the Supabase connection and Auth configuration, then try again.' } }); }
});

router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ email, password }).safeParse(req.body); if (!parsed.success) { res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Enter a valid email and password.' } }); return; }
  try {
    const admin = createSupabaseAdminClient(); const auth = createSupabaseAuthClient();
    const { data: result, error } = await auth.auth.signInWithPassword(parsed.data); if (error || !result.user) { await audit(admin, { action: 'FAILED_LOGIN', entity: 'USER', metadata: { email: parsed.data.email }, ip_address: req.ip }); res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: genericLoginError } }); return; }
    await auth.auth.signOut();
    const { data: profile } = await admin.from('profiles').select('id,email,full_name,role,status').eq('id', result.user.id).maybeSingle(); if (!profile || profile.status !== 'ACTIVE') { res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: genericLoginError } }); return; }
    await createApplicationSession(admin, profile.id, req, res); res.json({ success: true, data: { authenticated: true, user: profile } });
  } catch (error) { console.error('auth login failed', error); res.status(503).json({ success: false, error: { code: 'AUTH_UNAVAILABLE', message: 'We could not sign you in. Please try again.' } }); }
});

router.post('/verify-code', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ challengeId: z.string().uuid(), code }).safeParse(req.body); if (!parsed.success) { res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Enter the 6-digit verification code.' } }); return; }
  const admin = createSupabaseAdminClient(); const { data: challenge } = await admin.from('auth_challenges').select('*').eq('id', parsed.data.challengeId).maybeSingle(); if (!challenge || challenge.status !== 'PENDING' || challenge.attempt_count >= challenge.max_attempts || new Date(challenge.expires_at) <= new Date()) { res.status(401).json({ success: false, error: { code: 'INVALID_CODE', message: 'The code is invalid or expired.' } }); return; }
  try { const auth = createSupabaseAuthClient(); const { data, error } = await auth.auth.verifyOtp({ email: challenge.email, token: parsed.data.code, type: 'email' }); await auth.auth.signOut(); if (error || !data.user) { await admin.from('auth_challenges').update({ attempt_count: challenge.attempt_count + 1, status: challenge.attempt_count + 1 >= challenge.max_attempts ? 'LOCKED' : 'PENDING' }).eq('id', challenge.id); await audit(admin, { user_id: challenge.user_id, action: 'OTP_FAILED', entity: 'USER', entity_id: challenge.user_id, ip_address: req.ip }); res.status(401).json({ success: false, error: { code: 'INVALID_CODE', message: 'The code is invalid or expired.' } }); return; } const raw = randomToken(); await admin.from('auth_challenges').update({ status: 'VERIFIED', used_at: new Date().toISOString() }).eq('id', challenge.id); await admin.from('profiles').update({ email_verified: true }).eq('id', challenge.user_id); await admin.from('sessions').insert({ user_id: challenge.user_id, session_token_hash: hashToken(raw), expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), ip_address: req.ip, user_agent: req.get('user-agent') }); await audit(admin, { user_id: challenge.user_id, action: 'OTP_VERIFIED', entity: 'USER', entity_id: challenge.user_id, ip_address: req.ip }); const { data: profile } = await admin.from('profiles').select('id,email,full_name,role,status').eq('id', challenge.user_id).single(); sessionCookie(res, raw, 8 * 60 * 60 * 1000); res.json({ success: true, data: { authenticated: true, user: profile } }); } catch (error) { console.error('auth verification failed', error); res.status(503).json({ success: false, error: { code: 'AUTH_UNAVAILABLE', message: 'Something went wrong. Please try again.' } }); }
});

router.post('/resend-code', otpLimiter, async (req: Request, res: Response): Promise<void> => { const parsed = z.object({ challengeId: z.string().uuid() }).safeParse(req.body); if (!parsed.success) { res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid verification request.' } }); return; } const admin = createSupabaseAdminClient(); const { data: challenge } = await admin.from('auth_challenges').select('*').eq('id', parsed.data.challengeId).maybeSingle(); if (!challenge || challenge.status !== 'PENDING' || new Date(challenge.expires_at) <= new Date()) { res.status(401).json({ success: false, error: { code: 'INVALID_CHALLENGE', message: 'This verification request has expired.' } }); return; } const auth = createSupabaseAuthClient(); const { error } = await auth.auth.signInWithOtp({ email: challenge.email, options: { shouldCreateUser: false } }); if (error) { res.status(503).json({ success: false, error: { code: 'EMAIL_UNAVAILABLE', message: 'We could not send the verification code. Please try again.' } }); return; } await audit(admin, { user_id: challenge.user_id, action: 'OTP_REQUESTED', entity: 'USER', entity_id: challenge.user_id, ip_address: req.ip }); res.json({ success: true, data: { maskedEmail: maskEmail(challenge.email) } }); });
router.get('/me', requireAuth, (req: Request, res: Response) => res.json({ success: true, data: { user: req.user } }));
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => { const raw = req.cookies.ellext_session as string; const admin = createSupabaseAdminClient(); await admin.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('session_token_hash', hashToken(raw)); await audit(admin, { user_id: req.user?.id, action: 'LOGOUT', entity: 'USER', entity_id: req.user?.id, ip_address: req.ip }); res.clearCookie('ellext_session', { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: '/' }); res.status(204).end(); });
router.post('/forgot-password', authLimiter, async (req: Request, res: Response): Promise<void> => { const parsed = z.object({ email }).safeParse(req.body); if (parsed.success) { const auth = createSupabaseAuthClient(); await auth.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${env.appUrl}/reset-password` }); } res.json({ success: true, data: { message: "If the account exists, we've sent password reset instructions." } }); });

export default router;
