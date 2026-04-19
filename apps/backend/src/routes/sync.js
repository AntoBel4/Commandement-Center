import { buildSuccess } from '../schemas/common.js';
import { getRequestId } from '../utils/request-id.js';

const SERVICES = ['google', 'telegram', 'notion', 'daily-report'];

export default async function syncRoutes(app) {
  for (const service of SERVICES) {
    app.post(`/api/v1/sync/${service}`, async (request, reply) => {
      const requestId = getRequestId(request);
      const log = app.store.createSyncLog({
        entity_type: 'system',
        entity_id: 'manual-trigger',
        service,
        action: 'create',
        status: 'pending',
        response_data: { triggeredBy: 'api' }
      });

      app.log.info({ action: 'sync.triggered', service }, 'Manual sync triggered');
      return reply.send(buildSuccess({ queued: true, log }, requestId));
    });
  }
}
