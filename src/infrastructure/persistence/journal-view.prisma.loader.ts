import type { Prisma } from '@prisma/client';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type { JournalView } from '@/domain/repositories/journal-read.repository.interface.js';
import {
    JOURNAL_VIEW_INCLUDE,
    toJournalView,
} from '@/infrastructure/persistence/journal-view.prisma.mapper.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

export interface JournalViewQuery {
    where: Prisma.JournalEntryWhereInput;
    orderBy: Prisma.JournalEntryOrderByWithRelationInput[];
    skip?: number;
    take?: number;
}

/** Lê os lançamentos com as contas (join) e o estorno de cada lançamento manual, em 2 queries. */
export async function loadJournalViews(
    prisma: Pick<PrismaService, 'journalEntry'>,
    query: JournalViewQuery,
): Promise<JournalView[]> {
    const rows = await prisma.journalEntry.findMany({
        ...query,
        include: JOURNAL_VIEW_INCLUDE,
        relationLoadStrategy: 'join',
    });
    const manualIds = rows
        .filter(row => row.referenceType === JournalRefType.MANUAL)
        .map(row => row.id);
    const reversals =
        manualIds.length === 0
            ? []
            : await prisma.journalEntry.findMany({
                  where: {
                      referenceType: JournalRefType.MANUAL_REVERSAL,
                      referenceId: { in: manualIds },
                  },
                  select: { id: true, referenceId: true },
              });
    const reversedBy = new Map(reversals.map(item => [item.referenceId, item.id]));
    return rows.map(row => toJournalView(row, reversedBy.get(row.id) ?? null));
}
