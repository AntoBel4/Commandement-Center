import Fastify from 'fastify';
import cors from '@fastify/cors';
import eventRoutes from './routes/events.js';
import groceryRoutes from './routes/grocery.js';
import syncRoutes from './routes/sync.js';
import webhookRoutes from './routes/webhooks.js';
import { store } from './services/store.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty'
      }
    }
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  app.decorate('store', store);

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(eventRoutes);
  app.register(groceryRoutes);
  app.register(syncRoutes);
  app.register(webhookRoutes);

  return app;
}
