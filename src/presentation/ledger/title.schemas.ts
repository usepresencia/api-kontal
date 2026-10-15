import { z } from 'zod';
import { TitleStatus } from '@/domain/entities/title.entity.js';
import { TitleType } from '@/domain/ledger/title-type.js';
import { isoDateSchema } from '@/presentation/common/iso-date.js';
import { moneySchema } from '@/presentation/common/money.schema.js';
import { pageQuerySchema } from '@/presentation/common/page-query.schema.js';

const text = z.string().trim().min(1).max(255);

/** Taxa de juros mensal entre 0 e 1, com até 2 casas decimais. */
export const feesSchema = z
    .number()
    .min(0)
    .max(1)
    .refine(value => Math.round(value * 100) / 100 === value, 'Use até 2 casas decimais');

export const createTitleSchema = z.object({
    presetId: z.uuid(),
    type: z.enum(TitleType),
    description: text,
    amount: moneySchema,
    issueDate: isoDateSchema.optional(),
    expirationDate: isoDateSchema,
    feesPercentageMonthly: feesSchema.optional(),
});

export type CreateTitleBody = z.infer<typeof createTitleSchema>;

/** Campos editáveis mais os travados, aceitos só para o domínio recusar se mudarem. */
export const updateTitleSchema = z.object({
    description: text.optional(),
    expirationDate: isoDateSchema.optional(),
    feesPercentageMonthly: feesSchema.optional(),
    type: z.enum(TitleType).optional(),
    amount: moneySchema.optional(),
    presetId: z.uuid().optional(),
    issueDate: isoDateSchema.optional(),
});

export type UpdateTitleBody = z.infer<typeof updateTitleSchema>;

export const writeOffSchema = z.object({
    paidAt: isoDateSchema.optional(),
    description: z.string().trim().max(255).optional(),
});

export type WriteOffBody = z.infer<typeof writeOffSchema>;

export const listTitlesQuerySchema = pageQuerySchema.extend({
    type: z.enum(TitleType).optional(),
    status: z.enum(TitleStatus).optional(),
    presetId: z.uuid().optional(),
    seriesId: z.uuid().optional(),
    dueFrom: isoDateSchema.optional(),
    dueTo: isoDateSchema.optional(),
});

export type ListTitlesQuery = z.infer<typeof listTitlesQuerySchema>;
