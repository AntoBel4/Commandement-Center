import { z } from 'zod';
import { SourceSchema } from './common.js';

export const EventCreateSchema = z.object({
  title: z.string().min(1),
  date: z.string().date(),
  time: z.string().optional(),
  person: z.string().optional(),
  description: z.string().optional(),
  eventType: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  source: SourceSchema.optional()
});

export const EventUpdateSchema = EventCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required'
);

export const EventQuerySchema = z.object({
  date: z.string().date().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional()
});
