import Fastify from 'fastify';
import cors from '@fastify/cors';
import eventRoutes from './routes/events.js';
import groceryRoutes from './routes/grocery.js';
import syncRoutes from './routes/sync.js';
import webhookRoutes from './routes/webhooks.js';
import { createStore } from './services/store.js';
import { registerAuth } from './utils/auth.js';

export async function buildApp({ store = createStore() } = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty'
      }
    }
  });

  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  app.decorate('store', store);
  registerAuth(app);
  app.addHook('onClose', async () => {
    if (typeof store.close === 'function') await store.close();
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(eventRoutes);
  app.register(groceryRoutes);
  app.register(syncRoutes);
  app.register(webhookRoutes);

  return app;
}
