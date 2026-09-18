import { buildAlexaApp } from './app.js';

const app = buildAlexaApp({skillId: process.env.ALEXA_SKILL_ID, familyId: process.env.FAMILY_ID,
  apiBaseUrl: process.env.FAMILY_API_BASE_URL});
await app.listen({host: '0.0.0.0', port: Number(process.env.PORT || 3001)});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
