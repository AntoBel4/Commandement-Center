import Fastify from 'fastify';
import { SkillRequestSignatureVerifier, TimestampVerifier } from 'ask-sdk-express-adapter';
import { createSkill } from './handler.js';

export function buildAlexaApp({skillId, familyId, apiBaseUrl, fetchImpl,
  // Fresh verifier avoids trusting an expired certificate retained in the SDK's unbounded cache.
  signatureVerifier = {verify: (body, headers) => new SkillRequestSignatureVerifier().verify(body, headers)},
  timestampVerifier = new TimestampVerifier()} = {}) {
  const skill = createSkill({skillId, familyId, apiBaseUrl, fetchImpl});
  // No request logging: the envelope contains the linked account's bearer token.
  const app = Fastify({logger: false, bodyLimit: 128 * 1024, requestTimeout: 8000});
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', {parseAs: 'string'}, (_request, body, done) => done(null, body));
  app.get('/health', async () => ({status: 'ok'}));
  app.post('/integrations/alexa', async (request, reply) => {
    let envelope;
    try {
      envelope = JSON.parse(request.body);
      const time = Date.parse(envelope.request?.timestamp);
      if (!Number.isFinite(time) || Math.abs(Date.now() - time) > 150000) throw new Error('Invalid timestamp');
      // Verify the unchanged body, before invoking any handler or using its token.
      await timestampVerifier.verify(request.body);
      await signatureVerifier.verify(request.body, request.headers);
      if (envelope.context?.System?.application?.applicationId !== skillId ||
          (envelope.session && envelope.session.application?.applicationId !== skillId) ||
          envelope.request?.locale !== 'fr-FR' ||
          !['LaunchRequest', 'IntentRequest', 'SessionEndedRequest'].includes(envelope.request?.type)) {
        throw new Error('Wrong skill, locale or request type');
      }
    } catch {
      return reply.code(400).send({error: 'Invalid Alexa request'});
    }
    try { return await skill.invoke(envelope); }
    catch { return reply.code(500).send({error: 'Unavailable'}); }
  });
  return app;
}
