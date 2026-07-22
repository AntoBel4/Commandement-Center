import { buildSuccess } from '../schemas/common.js';
import { getRequestId } from '../utils/request-id.js';

const SERVICES = ['google', 'telegram', 'notion', 'daily-report'];

export default async function syncRoutes(app) {
  for (const service of SERVICES) {
    app.post(`/api/v1/sync/${service}`, async (request, reply) => {
      const requestId = getRequestId(request);
      const log = await app.store.createSyncLog({
        entity_type: 'system',
        entity_id: 'manual-trigger',
        service,
        action: 'create',
        status: 'pending',
        response_data: { triggeredBy: 'api' }
      }, request.familyId);

      app.log.info({ action: 'sync.triggered', service }, 'Manual sync triggered');
      return reply.send(buildSuccess({ queued: true, log }, requestId));
    });
  }

  app.get('/api/v1/sync/logs', async (request, reply) => {
    const requestId = getRequestId(request);
    const limit = Number(request.query?.limit ?? 50);
    const logs = await app.store.listSyncLogs(request.familyId, limit);
    return reply.send(buildSuccess(logs, requestId));
  });
}
