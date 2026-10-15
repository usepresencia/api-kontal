import { z } from 'zod';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import { isoDateSchema } from '@/presentation/common/iso-date.js';
import { moneySchema } from '@/presentation/common/money.schema.js';
import { pageQuerySchema } from '@/presentation/common/page-query.schema.js';

export const listJournalEntriesQuerySchema = pageQuerySchema.extend({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    referenceType: z.enum(JournalRefType).optional(),
    referenceId: z.string().min(1).max(64).optional(),
    accountId: z.uuid().optional(),
});

export type ListJournalEntriesQuery = z.infer<typeof listJournalEntriesQuerySchema>;

const manualLineSchema = z
    .object({
        accountId: z.uuid(),
        debit: moneySchema.optional(),
        credit: moneySchema.optional(),
        memo: z.string().trim().max(255).optional(),
    })
    .refine(line => (line.debit ?? 0) > 0 !== (line.credit ?? 0) > 0, {
        message: 'Informe débito ou crédito maior que zero, não os dois',
    });

export const createManualEntrySchema = z.object({
    date: isoDateSchema,
    description: z.string().trim().min(1).max(255),
    lines: z.array(manualLineSchema).min(2).max(50),
});

export type CreateManualEntryBody = z.infer<typeof createManualEntrySchema>;

export const reverseManualEntrySchema = z.object({
    description: z.string().trim().min(1).max(255).optional(),
});

export type ReverseManualEntryBody = z.infer<typeof reverseManualEntrySchema>;
