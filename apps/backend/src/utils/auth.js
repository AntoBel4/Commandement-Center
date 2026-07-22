import { createRemoteJWKSet, jwtVerify } from 'jose';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(reply, statusCode, code, message) {
  return reply.code(statusCode).send({
    success: false,
    error: { code, message, details: null },
    meta: { requestId: reply.request.id, timestamp: new Date().toISOString() }
  });
}

export function registerAuth(app) {
  app.decorateRequest('user', null);
  app.decorateRequest('familyId', null);
  let jwks;

  app.addHook('onRequest', async (request, reply) => {
    if (process.env.AUTH_ENABLED !== 'true' || request.url.startsWith('/health')) return;

    const issuer = process.env.AUTH_ISSUER_URL;
    const audience = process.env.AUTH_AUDIENCE;
    const jwksUrl = process.env.AUTH_JWKS_URL;
    if (!issuer || !audience || !jwksUrl) {
      return error(reply, 503, 'AUTH_NOT_CONFIGURED', 'Authentification non configurée');
    }

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return error(reply, 401, 'UNAUTHORIZED', 'Authentification requise');
    }

    try {
      const token = header.slice('Bearer '.length);
      jwks ??= createRemoteJWKSet(new URL(jwksUrl));
      const { payload } = await jwtVerify(token, jwks, { issuer });
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(audience) && payload.azp !== audience) {
        throw new Error('Token audience is not authorized for this API');
      }
      const familyId = request.headers['x-family-id'];
      if (typeof familyId !== 'string' || !UUID_PATTERN.test(familyId)) {
        return error(reply, 400, 'FAMILY_REQUIRED', 'X-Family-Id est requis');
      }
      if (!payload.sub || !(await app.store.isFamilyMember(payload.sub, familyId))) {
        return error(reply, 403, 'FAMILY_FORBIDDEN', 'Accès refusé à cette famille');
      }
      request.user = payload;
      request.familyId = familyId;
    } catch (cause) {
      request.log.warn({ err: cause }, 'Authentication failed');
      return error(reply, 401, 'UNAUTHORIZED', 'Jeton invalide');
    }
  });
}
