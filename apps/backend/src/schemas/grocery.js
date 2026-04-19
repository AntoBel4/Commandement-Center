import { z } from 'zod';
import { SourceSchema } from './common.js';

export const GroceryItemInputSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  source: SourceSchema.optional()
});

export const GroceryBatchCreateSchema = z.object({
  items: z.array(GroceryItemInputSchema).min(1)
});

export const GroceryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  purchased: z.boolean().optional(),
  purchasedBy: z.string().optional()
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const GroceryQuerySchema = z.object({
  purchased: z.enum(['true', 'false']).optional(),
  category: z.string().optional()
});
