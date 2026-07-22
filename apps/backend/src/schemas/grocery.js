import { z } from 'zod';
import { SourceSchema } from './common.js';

export const GroceryItemInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  quantity: z.number().positive().optional(),
  unit: z.string().trim().max(50).optional(),
  category: z.string().trim().max(100).optional(),
  source: SourceSchema.optional()
});

export const GroceryBatchCreateSchema = z.object({
  items: z.array(GroceryItemInputSchema).min(1)
});

export const GroceryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().trim().max(50).optional(),
  category: z.string().trim().max(100).optional(),
  purchased: z.boolean().optional(),
  purchasedBy: z.string().trim().max(100).optional()
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const GroceryQuerySchema = z.object({
  purchased: z.enum(['true', 'false']).optional(),
  category: z.string().optional()
});
