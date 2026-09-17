import { createApp } from './app.js';
import { env } from './config/env.js';

const server = createApp().listen(env.port, () => console.log(`Ellext Billing API listening on ${env.port}`));
const shutdown = (): void => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10_000).unref(); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
