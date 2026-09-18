import { z } from 'zod';
import { SourceSchema } from './common.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(value + 'T12:00:00Z');
  return Number(value.slice(0, 4)) >= 1 && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date invalide');
const quantity = z.number().positive().max(99999999.99).multipleOf(0.01);
const status = z.enum(['open', 'purchased', 'cancelled']);
const editable = {
  name: z.string().trim().min(1).max(255),
  quantity: quantity.nullable().optional(),
  unit: z.string().trim().max(50).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  availableOn: date.optional(),
  urgent: z.boolean().optional()
};
export const GroceryItemInputSchema = z.object({
  ...editable, source: SourceSchema.optional()
}).strict();
export const GroceryBatchCreateSchema = z.object({
  items: z.array(GroceryItemInputSchema).min(1).max(100)
}).strict();
export const GroceryUpdateSchema = z.object({
  ...editable, name: editable.name.optional(), version: z.number().int().positive(),
  status: status.optional(), purchased: z.boolean().optional(),
  assignedTo: z.string().uuid().transform((value) => value.toLowerCase()).nullable().optional()
}).strict().refine((value) => Object.keys(value).length > 1, 'Une modification est requise')
  .refine((value) => value.status === undefined || value.purchased === undefined, 'Utilisez status ou purchased');
export const GroceryQuerySchema = z.object({
  purchased: z.enum(['true', 'false']).optional(), category: z.string().max(100).optional(),
  status: status.optional(), availableOn: date.optional()
}).strict();
export const GroceryIdSchema = z.string().uuid();
export const GroceryDeleteSchema = z.object({ version: z.coerce.number().int().positive() }).strict();
export const IdempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
