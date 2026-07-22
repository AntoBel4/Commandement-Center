import { buildError, buildSuccess } from '../schemas/common.js';
import { GroceryBatchCreateSchema, GroceryQuerySchema, GroceryUpdateSchema } from '../schemas/grocery.js';
import { getRequestId } from '../utils/request-id.js';

export default async function groceryRoutes(app) {
  app.post('/api/v1/grocery/batch', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = GroceryBatchCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(buildError('VALIDATION_ERROR', 'Données invalides', parsed.error.flatten(), requestId));
    }

    const items = await app.store.addGroceryBatch(parsed.data.items, request.familyId);
    app.log.info({ action: 'grocery.batch_created', count: items.length }, 'Grocery batch created');
    return reply.code(201).send(buildSuccess({ count: items.length, items }, requestId));
  });

  app.get('/api/v1/grocery', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = GroceryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(buildError('VALIDATION_ERROR', 'Filtres invalides', parsed.error.flatten(), requestId));
    }

    const groceries = await app.store.listGroceries({
      purchased: parsed.data.purchased === undefined ? undefined : parsed.data.purchased === 'true',
      category: parsed.data.category,
      familyId: request.familyId
    });

    return reply.send(buildSuccess(groceries, requestId));
  });

  app.put('/api/v1/grocery/:id', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = GroceryUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(buildError('VALIDATION_ERROR', 'Données invalides', parsed.error.flatten(), requestId));
    }

    const item = await app.store.updateGrocery(request.params.id, parsed.data, request.familyId);
    if (!item) {
      return reply.code(404).send(buildError('NOT_FOUND', 'Article introuvable', null, requestId));
    }

    return reply.send(buildSuccess(item, requestId));
  });

  app.delete('/api/v1/grocery/:id', async (request, reply) => {
    const requestId = getRequestId(request);
    const deleted = await app.store.deleteGrocery(request.params.id, request.familyId);
    if (!deleted) {
      return reply.code(404).send(buildError('NOT_FOUND', 'Article introuvable', null, requestId));
    }

    return reply.send(buildSuccess({ deleted: true }, requestId));
  });
}
