import { buildError, buildSuccess } from '../schemas/common.js';
import { EventCreateSchema, EventQuerySchema, EventUpdateSchema } from '../schemas/events.js';
import { getRequestId } from '../utils/request-id.js';

export default async function eventRoutes(app) {
  app.post('/api/v1/events', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = EventCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(buildError('VALIDATION_ERROR', 'Données invalides', parsed.error.flatten(), requestId));
    }

    const event = app.store.createEvent(parsed.data);
    app.log.info({ action: 'event.created', entity_id: event.id }, 'Event created');
    return reply.code(201).send(buildSuccess(event, requestId));
  });

  app.get('/api/v1/events', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = EventQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(buildError('VALIDATION_ERROR', 'Filtres invalides', parsed.error.flatten(), requestId));
    }

    const events = app.store.listEvents(parsed.data);
    return reply.send(buildSuccess(events, requestId));
  });

  app.get('/api/v1/events/:id', async (request, reply) => {
    const requestId = getRequestId(request);
    const event = app.store.getEvent(request.params.id);
    if (!event) {
      return reply.code(404).send(buildError('NOT_FOUND', 'Événement introuvable', null, requestId));
    }

    return reply.send(buildSuccess(event, requestId));
  });

  app.put('/api/v1/events/:id', async (request, reply) => {
    const requestId = getRequestId(request);
    const parsed = EventUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(buildError('VALIDATION_ERROR', 'Données invalides', parsed.error.flatten(), requestId));
    }

    const event = app.store.updateEvent(request.params.id, parsed.data);
    if (!event) {
      return reply.code(404).send(buildError('NOT_FOUND', 'Événement introuvable', null, requestId));
    }

    return reply.send(buildSuccess(event, requestId));
  });

  app.delete('/api/v1/events/:id', async (request, reply) => {
    const requestId = getRequestId(request);
    const deleted = app.store.deleteEvent(request.params.id);
    if (!deleted) {
      return reply.code(404).send(buildError('NOT_FOUND', 'Événement introuvable', null, requestId));
    }

    return reply.send(buildSuccess({ deleted: true }, requestId));
  });
}
