import type { Prisma } from '@prisma/client';
import type { JournalView } from '@/domain/repositories/journal-read.repository.interface.js';
import { toJournalEntity } from '@/infrastructure/persistence/journal.prisma.mapper.js';

/** Linhas lidas com o código e o nome da conta. */
export const JOURNAL_VIEW_INCLUDE = {
    lines: { include: { account: { select: { code: true, name: true } } } },
} as const;

export type JournalWithAccounts = Prisma.JournalEntryGetPayload<{
    include: typeof JOURNAL_VIEW_INCLUDE;
}>;

export function toJournalView(row: JournalWithAccounts, reversedBy: string | null): JournalView {
    return {
        entry: toJournalEntity(row),
        number: Number(row.number),
        accounts: Object.fromEntries(
            row.lines.map(line => [
                line.accountId,
                { code: line.account.code, name: line.account.name },
            ]),
        ),
        reversedBy,
    };
}
