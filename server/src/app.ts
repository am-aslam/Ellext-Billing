import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import { env } from './config/env.js';

export const createApp = (): express.Express => { const app = express(); app.disable('x-powered-by'); app.use(helmet({ contentSecurityPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, crossOriginEmbedderPolicy: false })); app.use(cors({ origin: env.corsOrigin, credentials: true })); app.use(cookieParser()); app.use(express.json({ limit: '1mb' })); app.get('/health', (_req, res) => res.json({ status: 'ok' })); app.get('/ready', (_req, res) => res.json({ status: 'ok' })); app.use('/api/auth', authRoutes); app.use('/auth', authRoutes); app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found.' } })); app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } })); return app; };
