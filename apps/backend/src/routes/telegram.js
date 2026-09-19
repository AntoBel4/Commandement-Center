import {z} from 'zod';
import {buildSuccess,buildError} from '../schemas/common.js';
export default async function telegramRoutes(app) {
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('cache-control','no-store');
    if(!app.telegram)return reply.code(503).send(buildError('TELEGRAM_UNAVAILABLE','Telegram est à préparer.',null,req.id));
    if(req.familyId!==app.telegram.familyId)return reply.code(403).send(buildError('FAMILY_FORBIDDEN','Accès refusé',null,req.id));
  });
  const run=async(req,reply,action)=>{
    try {return buildSuccess(await action(),req.id);}
    catch {return reply.code(409).send(buildError('TELEGRAM_STATE','Actualisez les réglages puis réessayez.',null,req.id));}
  };
  app.get('/api/v1/telegram',async(req,reply)=>run(req,reply,()=>app.telegram.status(req.user.sub)));
  app.post('/api/v1/telegram/link',async(req,reply)=>run(req,reply,()=>app.telegram.pair(req.user.sub)));
  app.post('/api/v1/telegram/settings',async(req,reply)=>{
    const body=z.object({action:z.enum(['enable','disable','quiet','resume','unlink'])}).strict().safeParse(req.body);
    if(!body.success)return reply.code(400).send(buildError('VALIDATION_ERROR','Réglage invalide',null,req.id));
    return run(req,reply,()=>app.telegram.settings(req.user.sub,body.data.action));
  });
  app.post('/api/v1/telegram/test',async(req,reply)=>{
    const key=z.string().uuid().safeParse(req.headers['idempotency-key']);
    if(!key.success)return reply.code(400).send(buildError('VALIDATION_ERROR','Envoi invalide',null,req.id));
    return run(req,reply,()=>app.telegram.requestTest(req.user.sub,key.data));
  });
}
