import { z } from 'zod';
import { SeriesFrequency, SeriesKind } from '@/domain/series/series-schedule.js';
import { TitleType } from '@/domain/ledger/title-type.js';
import { isoDateSchema } from '@/presentation/common/iso-date.js';
import { moneySchema } from '@/presentation/common/money.schema.js';
import { pageQuerySchema } from '@/presentation/common/page-query.schema.js';
import { feesSchema } from '@/presentation/ledger/title.schemas.js';

const count = z.number().int().min(1);

export const createSeriesSchema = z.object({
    kind: z.enum(SeriesKind),
    presetId: z.uuid(),
    type: z.enum(TitleType),
    description: z.string().trim().min(1).max(255),
    amount: moneySchema,
    issueDate: isoDateSchema.optional(),
    expirationDate: isoDateSchema,
    feesPercentageMonthly: feesSchema.optional(),
    frequency: z.enum(SeriesFrequency).optional(),
    count: count.optional(),
    until: isoDateSchema.optional(),
    destinationAccountId: z.uuid().optional(),
});

export type CreateSeriesBody = z.infer<typeof createSeriesSchema>;

/** Quantidade ou data final; o domínio exige exatamente um dos dois. */
export const extendSeriesSchema = z.object({
    count: count.optional(),
    until: isoDateSchema.optional(),
});

export type ExtendSeriesBody = z.infer<typeof extendSeriesSchema>;

export const listSeriesQuerySchema = pageQuerySchema.extend({
    kind: z.enum(SeriesKind).optional(),
});

export type ListSeriesQuery = z.infer<typeof listSeriesQuerySchema>;
