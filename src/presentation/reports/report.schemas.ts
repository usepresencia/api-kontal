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

export const trialBalanceQuerySchema = periodQuerySchema.extend({
    maxLevel: z.coerce.number().int().min(1).max(5).optional(),
});

export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;

export const balanceSheetQuerySchema = z.object({
    date: isoDateSchema,
    billingPlanId: z.uuid().optional(),
});

export type BalanceSheetQuery = z.infer<typeof balanceSheetQuerySchema>;

export const dailyJournalQuerySchema = periodQuerySchema.extend({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(31).default(7),
});

export type DailyJournalQuery = z.infer<typeof dailyJournalQuerySchema>;
