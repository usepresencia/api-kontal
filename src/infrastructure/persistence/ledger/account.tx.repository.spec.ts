import { AccountTxRepository } from '@/infrastructure/persistence/ledger/account.tx.repository.js';

function makeRepo() {
    const client = {
        billingAccount: { findMany: vi.fn() },
        title: { findMany: vi.fn().mockResolvedValue([{ controlAccountId: 'ar' }]) },
        presetAccount: {
            findMany: vi.fn().mockResolvedValue([{ accountId: 'ap' }, { accountId: 'ar' }]),
        },
    };
    return { client, repo: new AccountTxRepository(client as never) };
}

describe('AccountTxRepository.controlAccountIds', () => {
    it('une as contas de controle de títulos e as contas a receber/pagar de presets da empresa', async () => {
        const { client, repo } = makeRepo();
        await expect(repo.controlAccountIds('c1', ['ar', 'ap', 'bank'])).resolves.toEqual(
            new Set(['ar', 'ap']),
        );
        expect(client.title.findMany).toHaveBeenCalledWith({
            where: { companyId: 'c1', controlAccountId: { in: ['ar', 'ap', 'bank'] } },
            select: { controlAccountId: true },
            distinct: ['controlAccountId'],
        });
        expect(client.presetAccount.findMany).toHaveBeenCalledWith({
            where: {
                accountId: { in: ['ar', 'ap', 'bank'] },
                role: { in: ['receivable', 'payable'] },
                preset: { billingPlan: { companyId: 'c1' } },
            },
            select: { accountId: true },
            distinct: ['accountId'],
        });
    });

    it('sem ids não consulta', async () => {
        const { client, repo } = makeRepo();
        await expect(repo.controlAccountIds('c1', [])).resolves.toEqual(new Set());
        expect(client.title.findMany).not.toHaveBeenCalled();
    });
});
