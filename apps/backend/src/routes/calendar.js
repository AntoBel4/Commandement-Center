import { z } from 'zod';
import { buildError, buildSuccess } from '../schemas/common.js';
import { CalendarError } from '../services/google-calendar.js';
import { CalendarProposals, proposalSchema, actionSchema } from '../services/calendar-proposals.js';

const day = z.string().date().min(10).refine(v => v >= '2000-01-01' && v <= '2099-12-31');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const querySchema = z.object({from:day,to:day}).strict().refine(v => v.to >= v.from && Date.parse(v.to) - Date.parse(v.from) <= 92 * 86400000);
const eventSchema = z.object({ title:z.string().trim().min(1).max(255), date:day, endDate:day,
  allDay:z.boolean(), time:time.optional(), endTime:time.optional(), location:z.string().trim().max(255).default(''),
  description:z.string().trim().max(5000).default('') }).strict().refine(v => v.allDay || (v.time && v.endTime));
export default async function calendarRoutes(app) {
  const proposals = new CalendarProposals(app.store, app.calendar);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('cache-control','no-store');
    if (!app.calendar) return reply.code(503).send(buildError('CALENDAR_UNAVAILABLE','Agenda indisponible',null,request.id));
    if (request.familyId !== app.calendar.familyId) return reply.code(403).send(buildError('FAMILY_FORBIDDEN','Agenda non autorisé',null,request.id));
  });
  function failure(error, request, reply) {
    const status = error instanceof CalendarError ? error.status : 503;
    const code = error instanceof CalendarError ? error.code : 'CALENDAR_UNAVAILABLE';
    // Never log upstream bodies, credentials, tokens, or event text.
    app.log.warn({ action:'calendar.failed', code },'Calendar request failed');
    return reply.code(status).send(buildError(code,'Opération agenda non confirmée',null,request.id));
  }
  app.get('/api/v1/calendar/events', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send(buildError('VALIDATION_ERROR','Période invalide',null,request.id));
    try { return buildSuccess(await app.calendar.list(parsed.data),request.id); }
    catch (error) { return failure(error,request,reply); }
  });
  app.get('/api/v1/calendar/proposals', async(request,reply)=>{
    try { return buildSuccess(await proposals.list(request.familyId),request.id); }
    catch(error) { return failure(error,request,reply); }
  });
  app.post('/api/v1/calendar/proposals', async(request,reply)=>{
    const parsed=proposalSchema.safeParse(request.body);
    const key=z.string().uuid().safeParse(request.headers['idempotency-key']);
    if(!parsed.success||!key.success) return reply.code(400).send(buildError('VALIDATION_ERROR','Proposition invalide',null,request.id));
    try { return buildSuccess({proposal:await proposals.create(parsed.data,request.familyId,request.user.sub,key.data)},request.id); }
    catch(error) { return failure(error,request,reply); }
  });
  app.post('/api/v1/calendar/proposals/:id/actions', async(request,reply)=>{
    const parsed=actionSchema.safeParse(request.body), id=z.string().uuid().safeParse(request.params.id);
    if(!parsed.success||!id.success) return reply.code(400).send(buildError('VALIDATION_ERROR','Choix invalide',null,request.id));
    try { return buildSuccess({proposal:await proposals.act(request.familyId,id.data,request.user.sub,parsed.data)},request.id); }
    catch(error) { return failure(error,request,reply); }
  });
  app.post('/api/v1/calendar/events', async (request, reply) => {
    const parsed = eventSchema.safeParse(request.body);
    const key = z.string().uuid().safeParse(request.headers['idempotency-key']);
    if (!parsed.success || !key.success) return reply.code(400).send(buildError('VALIDATION_ERROR','Rendez-vous invalide',null,request.id));
    try { const result = await app.calendar.create(parsed.data,request.user.sub,key.data); return reply.code(result.replayed ? 200 : 201).send(buildSuccess(result,request.id)); }
    catch (error) { return failure(error,request,reply); }
  });
}
