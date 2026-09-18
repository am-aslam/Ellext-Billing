import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import { env, missingProductionEnv } from './config/env.js';

export const createApp = (): express.Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use((_req, res, next) => {
    if (missingProductionEnv.length) {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVER_CONFIG_ERROR',
          message: `The billing API is missing Vercel environment variables: ${missingProductionEnv.join(', ')}. Add them to the Vercel project and redeploy.`,
        },
      });
      return;
    }
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/auth', authRoutes);
  app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found.' } }));
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }));
  return app;
};
