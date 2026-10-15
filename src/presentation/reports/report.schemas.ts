import { z } from 'zod';
import { isoDateSchema } from '@/presentation/common/iso-date.js';

/** Período inclusivo e plano opcional, comuns aos relatórios de período. */
export const periodQuerySchema = z.object({
    start: isoDateSchema,
    end: isoDateSchema,
    billingPlanId: z.uuid().optional(),
});

export const dreQuerySchema = periodQuerySchema.extend({
    groupBy: z.enum(['month']).optional(),
});

export type DreQuery = z.infer<typeof dreQuerySchema>;
