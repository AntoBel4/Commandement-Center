import { randomUUID } from 'node:crypto';

export function getRequestId(request) {
  return request.id || randomUUID();
}
