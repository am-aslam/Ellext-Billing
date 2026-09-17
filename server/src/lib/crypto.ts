import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const randomToken = (): string => crypto.randomBytes(32).toString('base64url');
export const hashToken = (value: string): string => crypto.createHmac('sha256', env.cookieSecret || 'local-development-secret').update(value).digest('hex');
export const maskEmail = (email: string): string => { const [name, domain] = email.split('@'); return `${(name || '').slice(0, 1)}***@${domain || ''}`; };
