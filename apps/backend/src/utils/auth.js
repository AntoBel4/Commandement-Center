import { createRemoteJWKSet, jwtVerify } from 'jose';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(reply, statusCode, code, message) {
  return reply.code(statusCode).send({
    success: false, error: { code, message, details: null },
    meta: { requestId: reply.request.id, timestamp: new Date().toISOString() }
  });
}

export function authConfiguration() {
  return {
    enabled: process.env.AUTH_ENABLED !== 'false',
    issuer: process.env.AUTH_ISSUER_URL,
    audience: process.env.AUTH_AUDIENCE,
    jwksUrl: process.env.AUTH_JWKS_URL
  };
}

export function registerAuth(app, config = authConfiguration()) {
  if (!config.enabled && !['development', 'test'].includes(process.env.NODE_ENV)) {
    throw new Error('Authentication may only be disabled explicitly in development or test');
  }
  if (config.enabled && (!config.issuer || !config.audience || (!config.jwksUrl && !config.keyResolver))) {
    throw new Error('AUTH_ISSUER_URL, AUTH_AUDIENCE and AUTH_JWKS_URL are required');
  }
  const keys = config.enabled
    ? config.keyResolver ?? createRemoteJWKSet(new URL(config.jwksUrl))
    : null;
  app.decorateRequest('user', null);
  app.decorateRequest('familyId', null);
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (!config.enabled || (request.method === 'GET' && ['/health', '/ready'].includes(path))) return;
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return error(reply, 401, 'UNAUTHORIZED', 'Authentification requise');
    let payload;
    try {
      ({ payload } = await jwtVerify(header.slice(7), keys, {
        issuer: config.issuer, audience: config.audience,
        algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat']
      }));
      if (typeof payload.sub !== 'string' || !UUID_PATTERN.test(payload.sub)) throw new Error('Invalid subject');
    } catch {
      return error(reply, 401, 'UNAUTHORIZED', 'Jeton invalide');
    }
    // The linked Alexa client may add groceries only, even if its token is used directly.
    if (payload.azp === 'commandement-alexa' &&
        (request.method !== 'POST' || path !== '/api/v1/grocery/batch')) {
      return error(reply, 403, 'CLIENT_FORBIDDEN', 'Action non autorisée pour Alexa');
    }
    const familyHeader = request.headers['x-family-id'];
    const familyId = typeof familyHeader === 'string' ? familyHeader.toLowerCase() : familyHeader;
    if (typeof familyId !== 'string' || !UUID_PATTERN.test(familyId)) {
      return error(reply, 400, 'FAMILY_REQUIRED', 'X-Family-Id est requis');
    }
    try {
      if (!(await app.store.isFamilyMember(payload.sub.toLowerCase(), familyId))) {
        return error(reply, 403, 'FAMILY_FORBIDDEN', 'Accès refusé à cette famille');
      }
    } catch {
      return error(reply, 503, 'AUTH_UNAVAILABLE', 'Vérification des droits indisponible');
    }
    request.user = { ...payload, sub: payload.sub.toLowerCase() };
    request.familyId = familyId;
  });
}
