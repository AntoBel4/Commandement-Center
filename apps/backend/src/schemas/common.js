import { z } from 'zod';

export const SourceSchema = z.enum(['alexa', 'dashboard', 'telegram', 'phone']).default('alexa');

export const ResponseMetaSchema = z.object({
  requestId: z.string(),
  timestamp: z.string().datetime()
});

export function buildSuccess(data, requestId) {
  return {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  };
}

export function buildError(code, message, details, requestId) {
  return {
    success: false,
    error: { code, message, details },
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  };
}
