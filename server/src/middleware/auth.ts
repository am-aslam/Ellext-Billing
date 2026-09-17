import type { NextFunction, Request, Response } from 'express';
import { createSupabaseAdminClient } from '../lib/supabase.js';
import { env, isProduction } from '../config/env.js';
import { hashToken } from '../lib/crypto.js';

declare global { namespace Express { interface Request { user?: { id: string; email: string; role: 'ADMIN' | 'STAFF'; status: 'ACTIVE' | 'DISABLED' }; } } }

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const raw = req.cookies?.ellext_session as string | undefined;
  if (!raw) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } }); return; }
  try {
    const admin = createSupabaseAdminClient();
    const { data: session, error } = await admin.from('sessions').select('user_id,expires_at,revoked_at').eq('session_token_hash', hashToken(raw)).maybeSingle();
    if (error || !session || session.revoked_at || new Date(session.expires_at) <= new Date()) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } }); return; }
    const { data: profile } = await admin.from('profiles').select('id,email,role,status').eq('id', session.user_id).maybeSingle();
    if (!profile || profile.status !== 'ACTIVE') { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } }); return; }
    req.user = profile as Request['user']; await admin.from('sessions').update({ last_seen_at: new Date().toISOString() }).eq('session_token_hash', hashToken(raw)); next();
  } catch { res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable.' } }); }
};

export const requireRole = (...roles: Array<'ADMIN' | 'STAFF'>) => (req: Request, res: Response, next: NextFunction): void => { if (!req.user || !roles.includes(req.user.role)) { res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this resource.' } }); return; } next(); };
export const sessionCookie = (res: Response, value: string, maxAge: number): void => { res.cookie('ellext_session', value, { httpOnly: true, secure: isProduction, sameSite: 'lax', signed: false, maxAge, path: '/' }); };
