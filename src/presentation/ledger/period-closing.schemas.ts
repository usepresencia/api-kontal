import { z } from 'zod';

export const closePeriodSchema = z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o mês no formato YYYY-MM'),
    billingPlanId: z.uuid().optional(),
    retainedEarningsAccountId: z.uuid().optional(),
});

export type ClosePeriodBody = z.infer<typeof closePeriodSchema>;
