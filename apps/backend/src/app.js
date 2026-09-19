import telegramRoutes from './routes/telegram.js';
import {TelegramStore} from './services/telegram-store.js';
import {TelegramReminders} from './services/telegram-reminders.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import eventRoutes from './routes/events.js';
import groceryRoutes from './routes/grocery.js';
import syncRoutes from './routes/sync.js';
import webhookRoutes from './routes/webhooks.js';
import { createStore } from './services/store.js';
import { registerAuth } from './utils/auth.js';
import calendarRoutes from './routes/calendar.js';
import { calendarFromEnvironment } from './services/google-calendar.js';

export async function buildApp({ store = createStore(), auth, logger, calendar = calendarFromEnvironment(), telegram } = {}) {
  if (process.env.NODE_ENV === 'production' && store.constructor.name === 'InMemoryStore') {
    throw new Error('Production requires persistent storage');
  }
  const app = Fastify({
    logger: logger ?? {
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
  app.decorate('calendar', calendar);
  app.decorate('telegram',telegram??(process.env.TELEGRAM_BOT_USERNAME&&store.pool?new TelegramReminders({store:new TelegramStore(store.pool),familyId:process.env.GOOGLE_CALENDAR_FAMILY_ID,botUsername:process.env.TELEGRAM_BOT_USERNAME}):null));
  registerAuth(app, auth);
  app.addHook('onClose', async () => {
    if (typeof store.close === 'function') await store.close();
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (request, reply) => {
    try {
      await store.checkReady();
      if(app.telegram&&store.pool)await store.pool.query('select 1 from telegram_state limit 0');
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
  app.register(eventRoutes);
  app.register(calendarRoutes);
  app.register(telegramRoutes);
  app.register(groceryRoutes);
  app.register(syncRoutes);
  app.register(webhookRoutes);

  return app;
}
