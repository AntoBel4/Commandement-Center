import { z } from 'zod';
import { SourceSchema } from './common.js';

export const EventCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  date: z.string().date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time').optional(),
  person: z.string().trim().max(100).optional(),
  description: z.string().trim().max(5000).optional(),
  eventType: z.string().trim().max(50).optional(),
  location: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(5000).optional(),
  source: SourceSchema.optional()
});

export const EventUpdateSchema = EventCreateSchema.partial().extend({
  status: z.enum(['active', 'completed', 'cancelled']).optional()
}).refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required'
);

export const EventQuerySchema = z.object({
  date: z.string().date().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional()
});
