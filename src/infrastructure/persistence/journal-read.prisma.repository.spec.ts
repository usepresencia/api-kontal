import { JournalReadPrismaRepository } from '@/infrastructure/persistence/journal-read.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const dec = (text: string) => ({ toFixed: () => text });
const row = {
    id: 'j1',
    number: 3n,
    companyId: 'c1',
    date: new Date('2026-10-14T00:00:00.000Z'),
    description: 'd',
    referenceType: 'SETTLEMENT',
    referenceId: 'e1',
    totalDebits: dec('1.00'),
    totalCredits: dec('1.00'),
    createdAt: new Date('2026-10-14T12:00:00.000Z'),
    lines: [
        {
            id: 'l1',
            journalEntryId: 'j1',
            accountId: 'a',
            debit: dec('1.00'),
            credit: dec('0.00'),
            memo: '',
            account: { code: '1.1', name: 'Banco' },
        },
        {
            id: 'l2',
            journalEntryId: 'j1',
            accountId: 'b',
            debit: dec('0.00'),
            credit: dec('1.00'),
            memo: '',
            account: { code: '1.2', name: 'Clientes' },
        },
    ],
};

function makeRepo() {
    const journalEntry = { findMany: vi.fn(), count: vi.fn() };
    return {
        journalEntry,
        repo: new JournalReadPrismaRepository({ journalEntry } as unknown as PrismaService),
    };
}

describe('JournalReadPrismaRepository', () => {
    it('find escopa por id e empresa e devolve null quando não acha', async () => {
        const { repo, journalEntry } = makeRepo();
        journalEntry.findMany.mockResolvedValueOnce([row]);
        expect((await repo.find('c1', 'j1'))?.number).toBe(3);
        expect(journalEntry.findMany.mock.calls[0][0].where).toEqual({ id: 'j1', companyId: 'c1' });
        journalEntry.findMany.mockResolvedValueOnce([]);
        await expect(repo.find('c1', 'x')).resolves.toBeNull();
    });

    it('list aplica todos os filtros, ordena por data e número decrescentes e conta o total', async () => {
        const { repo, journalEntry } = makeRepo();
        journalEntry.findMany.mockResolvedValueOnce([row]);
        journalEntry.count.mockResolvedValue(21);
        const from = new Date('2026-10-01T00:00:00.000Z');
        const to = new Date('2026-10-31T00:00:00.000Z');
        const page = await repo.list(
            'c1',
            { from, to, referenceType: 'SETTLEMENT', referenceId: 'e1', accountId: 'a' },
            { page: 3, pageSize: 10 },
        );
        const where = {
            companyId: 'c1',
            date: { gte: from, lte: to },
            referenceType: 'SETTLEMENT',
            referenceId: 'e1',
            lines: { some: { accountId: 'a' } },
        };
        expect(journalEntry.findMany.mock.calls[0][0]).toMatchObject({
            where,
            orderBy: [{ date: 'desc' }, { number: 'desc' }],
            skip: 20,
            take: 10,
        });
        expect(journalEntry.count).toHaveBeenCalledWith({ where });
        expect(page).toMatchObject({ page: 3, pageSize: 10, total: 21 });
    });

    it('list sem filtros só escopa pela empresa; o período aceita um limite só', async () => {
        const { repo, journalEntry } = makeRepo();
        journalEntry.findMany.mockResolvedValue([]);
        journalEntry.count.mockResolvedValue(0);
        await repo.list('c1', {}, { page: 1, pageSize: 10 });
        expect(journalEntry.count).toHaveBeenLastCalledWith({ where: { companyId: 'c1' } });
        const from = new Date('2026-10-01T00:00:00.000Z');
        await repo.list('c1', { from }, { page: 1, pageSize: 10 });
        expect(journalEntry.count).toHaveBeenLastCalledWith({
            where: { companyId: 'c1', date: { gte: from } },
        });
        await repo.list('c1', { to: from }, { page: 1, pageSize: 10 });
        expect(journalEntry.count).toHaveBeenLastCalledWith({
            where: { companyId: 'c1', date: { lte: from } },
        });
    });
});
