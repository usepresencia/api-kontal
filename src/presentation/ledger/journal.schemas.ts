import { z } from 'zod';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import { isoDateSchema } from '@/presentation/common/iso-date.js';
import { pageQuerySchema } from '@/presentation/common/page-query.schema.js';

export const listJournalEntriesQuerySchema = pageQuerySchema.extend({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    referenceType: z.enum(JournalRefType).optional(),
    referenceId: z.string().min(1).max(64).optional(),
    accountId: z.uuid().optional(),
});

export type ListJournalEntriesQuery = z.infer<typeof listJournalEntriesQuerySchema>;
