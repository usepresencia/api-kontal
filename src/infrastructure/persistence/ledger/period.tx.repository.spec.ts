import { PeriodTxRepository } from '@/infrastructure/persistence/ledger/period.tx.repository.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function makeRepo() {
    const client = {
        $queryRaw: vi.fn(),
        periodClosing: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
        company: { update: vi.fn() },
    };
    return { client, repo: new PeriodTxRepository(client as never) };
}
const sqlOf = (call: unknown[]) => (call[0] as string[]).join('?');

describe('PeriodTxRepository', () => {
    it('lockCompany trava a linha da empresa (FOR UPDATE) e devolve a trava; null se não existe', async () => {
        const { repo, client } = makeRepo();
        client.$queryRaw
            .mockResolvedValueOnce([{ closedThrough: day('2026-09-30') }])
            .mockResolvedValueOnce([]);
        await expect(repo.lockCompany('c1')).resolves.toEqual({ closedThrough: day('2026-09-30') });
        expect(sqlOf(client.$queryRaw.mock.calls[0])).toContain('FOR UPDATE');
        await expect(repo.lockCompany('x')).resolves.toBeNull();
    });

    it('latest devolve o fechamento de maior data da empresa', async () => {
        const { repo, client } = makeRepo();
        client.periodClosing.findFirst.mockResolvedValue({ id: 'p1' });
        await expect(repo.latest('c1')).resolves.toEqual({ id: 'p1' });
        expect(client.periodClosing.findFirst).toHaveBeenCalledWith({
            where: { companyId: 'c1' },
            orderBy: { throughDate: 'desc' },
        });
    });

    it('insert, delete e setClosedThrough gravam pelos modelos do Prisma', async () => {
        const { repo, client } = makeRepo();
        const row = {
            id: 'p1',
            companyId: 'c1',
            throughDate: day('2026-09-30'),
            closingEntryId: null,
            createdAt: day('2026-10-14'),
        };
        await repo.insert(row);
        expect(client.periodClosing.create).toHaveBeenCalledWith({ data: row });
        await repo.delete('p1');
        expect(client.periodClosing.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
        await repo.setClosedThrough('c1', day('2026-09-30'));
        expect(client.company.update).toHaveBeenCalledWith({
            where: { id: 'c1' },
            data: { closedThrough: day('2026-09-30') },
        });
        await repo.setClosedThrough('c1', null);
        expect(client.company.update).toHaveBeenLastCalledWith({
            where: { id: 'c1' },
            data: { closedThrough: null },
        });
    });

    it('resultBalances soma débitos e créditos das contas de resultado do plano, sem apuração', async () => {
        const { repo, client } = makeRepo();
        client.$queryRaw.mockResolvedValue([{ accountId: 'rev', debit: '0', credit: '1000.50' }]);
        await expect(
            repo.resultBalances('c1', 'p1', day('2026-01-01'), day('2026-12-31')),
        ).resolves.toEqual([{ accountId: 'rev', debit: 0, credit: 100050 }]);
        const sql = sqlOf(client.$queryRaw.mock.calls[0]);
        expect(sql).toContain("'REVENUE', 'EXPENSE'");
        expect(sql).toContain("NOT IN ('CLOSING', 'CLOSING_REVERSAL')");
        expect(client.$queryRaw.mock.calls[0].slice(1)).toEqual([
            'c1',
            'p1',
            day('2026-01-01'),
            day('2026-12-31'),
        ]);
    });
});
