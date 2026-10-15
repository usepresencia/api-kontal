import { z } from 'zod';
import { PaymentMethod } from '@/domain/entities/entry.entity.js';
import { isoDateSchema } from '@/presentation/common/iso-date.js';
import { moneySchema } from '@/presentation/common/money.schema.js';
import { pageQuerySchema } from '@/presentation/common/page-query.schema.js';

const description = z.string().trim().max(255);

export const createEntrySchema = z.object({
    billingAccountId: z.uuid(),
    principalAmount: moneySchema,
    interestAmount: moneySchema.optional(),
    fineAmount: moneySchema.optional(),
    discountAmount: moneySchema.optional(),
    paidAt: isoDateSchema,
    paymentMethod: z.enum(PaymentMethod),
    description: description.optional(),
});

export type CreateEntryBody = z.infer<typeof createEntrySchema>;

/** Só descrição e forma de pagamento mudam; ao menos um campo é obrigatório. */
export const updateEntrySchema = z
    .object({
        description: description.optional(),
        paymentMethod: z.enum(PaymentMethod).optional(),
    })
    .refine(body => Object.keys(body).length > 0, {
        message: 'Informe ao menos um campo para alterar',
    });

export type UpdateEntryBody = z.infer<typeof updateEntrySchema>;

export const listEntriesQuerySchema = pageQuerySchema.extend({
    titleId: z.uuid().optional(),
});

export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;
