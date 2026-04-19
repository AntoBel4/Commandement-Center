import { buildSuccess } from '../schemas/common.js';
import { getRequestId } from '../utils/request-id.js';

export default async function webhookRoutes(app) {
  app.post('/api/v1/webhooks/alexa', async (request, reply) => {
    const requestId = getRequestId(request);
    app.log.info({ action: 'webhook.alexa.received', payload: request.body }, 'Alexa webhook received');
    return reply.send(buildSuccess({ received: true }, requestId));
  });

  app.post('/api/v1/webhooks/telegram', async (request, reply) => {
    const requestId = getRequestId(request);
    app.log.info({ action: 'webhook.telegram.received', payload: request.body }, 'Telegram webhook received');
    return reply.send(buildSuccess({ received: true }, requestId));
  });

  app.post('/api/v1/webhooks/grocery-update', async (request, reply) => {
    const requestId = getRequestId(request);
    app.log.info({ action: 'webhook.grocery.received', payload: request.body }, 'Grocery webhook received');
    return reply.send(buildSuccess({ received: true }, requestId));
  });
}
