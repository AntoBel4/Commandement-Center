import { buildError, buildSuccess } from '../schemas/common.js';
import { GroceryBatchCreateSchema, GroceryQuerySchema, GroceryUpdateSchema,
  GroceryIdSchema, GroceryDeleteSchema, IdempotencyKeySchema } from '../schemas/grocery.js';
import { GroceryError } from '../services/grocery-model.js';
import { getRequestId } from '../utils/request-id.js';

export default async function groceryRoutes(app) {
  const invalid = (reply, requestId, issues) =>
    reply.code(400).send(buildError('VALIDATION_ERROR', 'Données invalides', issues, requestId));
  async function perform(request, reply, action) {
    try { return await action(); }
    catch (error) {
      if (!(error instanceof GroceryError)) throw error;
      return reply.code(error.statusCode).send(buildError(error.code, error.message, null, getRequestId(request)));
    }
  }

  app.post('/api/v1/grocery/batch', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = GroceryBatchCreateSchema.safeParse(request.body);
    const key = IdempotencyKeySchema.optional().safeParse(request.headers['idempotency-key']);
    if (!parsed.success || !key.success) return invalid(reply, requestId, null);
    return perform(request, reply, async () => {
      const items = await app.store.addGroceryBatch(parsed.data.items, request.familyId, {
        actorId: request.user?.sub ?? null, requestKey: key.data
      });
      return reply.code(201).send(buildSuccess({ count: items.length, items }, requestId));
    });
  });

  app.get('/api/v1/grocery', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = GroceryQuerySchema.safeParse(request.query);
    if (!parsed.success) return invalid(reply, requestId, parsed.error.flatten());
    const groceries = await app.store.listGroceries({
      ...parsed.data,
      purchased: parsed.data.purchased === undefined ? undefined : parsed.data.purchased === 'true',
      familyId: request.familyId
    });
    return reply.send(buildSuccess(groceries, requestId));
  });

  app.get('/api/v1/grocery/:id/history', async (request, reply) => {
    const requestId = getRequestId(request);
    if (!GroceryIdSchema.safeParse(request.params.id).success) return invalid(reply, requestId, null);
    const item = await app.store.getGrocery(request.params.id, request.familyId);
    if (!item) return reply.code(404).send(buildError('NOT_FOUND', 'Article introuvable', null, requestId));
    return reply.send(buildSuccess(await app.store.listGroceryHistory(item.id, request.familyId), requestId));
  });

  app.put('/api/v1/grocery/:id', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = GroceryUpdateSchema.safeParse(request.body);
    if (!GroceryIdSchema.safeParse(request.params.id).success || !parsed.success) return invalid(reply, requestId, null);
    return perform(request, reply, async () => {
      const item = await app.store.updateGrocery(request.params.id, parsed.data, request.familyId, request.user?.sub ?? null);
      if (!item) return reply.code(404).send(buildError('NOT_FOUND', 'Article introuvable', null, requestId));
      return reply.send(buildSuccess(item, requestId));
    });
  });

  // Cancellation preserves the record and audit trail. A PUT with status=open reopens it.
  app.delete('/api/v1/grocery/:id', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = GroceryDeleteSchema.safeParse(request.query);
    if (!GroceryIdSchema.safeParse(request.params.id).success || !parsed.success) return invalid(reply, requestId, null);
    return perform(request, reply, async () => {
      const item = await app.store.updateGrocery(request.params.id,
        { status: 'cancelled', version: parsed.data.version }, request.familyId, request.user?.sub ?? null);
      if (!item) return reply.code(404).send(buildError('NOT_FOUND', 'Article introuvable', null, requestId));
      return reply.send(buildSuccess({ cancelled: true, item }, requestId));
    });
  });
}
