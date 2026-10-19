import {
    JOURNAL_VIEW_INCLUDE,
    toJournalView,
} from '@/infrastructure/persistence/journal-view.prisma.mapper.js';
import { loadJournalViews } from '@/infrastructure/persistence/journal-view.prisma.loader.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const dec = (text: string) => ({ toFixed: () => text });
const rowOf = (id: string, referenceType: string, number: bigint) => ({
    id,
    number,
    companyId: 'c1',
    date: new Date('2026-10-14T00:00:00.000Z'),
    description: 'd',
    referenceType,
    referenceId: id,
    totalDebits: dec('100.00'),
    totalCredits: dec('100.00'),
    createdAt: new Date('2026-10-14T12:00:00.000Z'),
    lines: [
        {
            id: 'l1',
            journalEntryId: id,
            accountId: 'ar',
            debit: dec('100.00'),
            credit: dec('0.00'),
            memo: 'm',
            account: { code: '1.2', name: 'Clientes' },
        },
        {
            id: 'l2',
            journalEntryId: id,
            accountId: 'rev',
            debit: dec('0.00'),
            credit: dec('100.00'),
            memo: 'm',
            account: { code: '3.1', name: 'Vendas' },
        },
    ],
});

describe('toJournalView', () => {
    it('reidrata o lançamento em centavos, converte o número e indexa as contas pelo id', () => {
        const view = toJournalView(rowOf('j1', 'TITLE_CREATION', 7n) as never, null);
        expect(view.entry).toMatchObject({ id: 'j1', totalDebits: 10000 });
        expect(view.number).toBe(7);
        expect(view.reversedBy).toBeNull();
        expect(view.accounts).toEqual({
            ar: { code: '1.2', name: 'Clientes' },
            rev: { code: '3.1', name: 'Vendas' },
        });
    });
});

describe('loadJournalViews', () => {
    it('lê os lançamentos com as contas em join e, em uma segunda query, quem estornou os manuais', async () => {
        const findMany = vi
            .fn()
            .mockResolvedValueOnce([rowOf('m1', 'MANUAL', 1n), rowOf('t1', 'TITLE_CREATION', 2n)])
            .mockResolvedValueOnce([{ id: 'rv', referenceId: 'm1' }]);
        const prisma = { journalEntry: { findMany } } as unknown as PrismaService;
        const query = {
            where: { companyId: 'c1' },
            orderBy: [{ date: 'desc' as const }],
            skip: 10,
            take: 5,
        };
        const views = await loadJournalViews(prisma, query);
        expect(findMany).toHaveBeenNthCalledWith(1, {
            ...query,
            include: JOURNAL_VIEW_INCLUDE,
            relationLoadStrategy: 'join',
        });
        expect(findMany).toHaveBeenNthCalledWith(2, {
            where: { referenceType: 'MANUAL_REVERSAL', referenceId: { in: ['m1'] } },
            select: { id: true, referenceId: true },
        });
        expect(views.map(view => [view.entry.id, view.reversedBy])).toEqual([
            ['m1', 'rv'],
            ['t1', null],
        ]);
    });

    it('sem lançamento manual não faz a segunda query', async () => {
        const findMany = vi.fn().mockResolvedValueOnce([rowOf('t1', 'TITLE_CREATION', 2n)]);
        const prisma = { journalEntry: { findMany } } as unknown as PrismaService;
        await loadJournalViews(prisma, { where: {}, orderBy: [] });
        expect(findMany).toHaveBeenCalledTimes(1);
    });
});
