import { AccountNature } from '@/domain/billing/account-nature.js';
import { resolveDestination } from '@/application/ledger/destination-account.js';
import { bankRef, fakeTx, presetFixture } from '@test/support/ledger-fakes.js';

const imobRef = { ...bankRef, id: 'imob' };

function setup() {
    const tx = fakeTx();
    tx.accounts.findRefs.mockResolvedValue([imobRef]);
    tx.accounts.controlAccountIds.mockResolvedValue(new Set());
    return tx;
}

describe('resolveDestination', () => {
    it('sem destino devolve undefined e não consulta o banco', async () => {
        const tx = setup();
        await expect(
            resolveDestination(tx, 'c1', presetFixture, 'EXPENSE', undefined),
        ).resolves.toBeUndefined();
        expect(tx.accounts.findRefs).not.toHaveBeenCalled();
    });

    it('valida a conta contra o plano do preset e as contas de controle e a devolve', async () => {
        const tx = setup();
        await expect(resolveDestination(tx, 'c1', presetFixture, 'EXPENSE', 'imob')).resolves.toBe(
            'imob',
        );
        expect(tx.accounts.findRefs).toHaveBeenCalledWith('c1', ['imob']);
        expect(tx.accounts.controlAccountIds).toHaveBeenCalledWith('c1', ['imob']);
    });

    it('título a receber com destino é recusado antes de consultar', async () => {
        const tx = setup();
        await expect(
            resolveDestination(tx, 'c1', presetFixture, 'INCOME', 'imob'),
        ).rejects.toMatchObject({
            code: 'DESTINATION_ACCOUNT_INVALID',
        });
        expect(tx.accounts.findRefs).not.toHaveBeenCalled();
    });

    it('conta de controle, de receita ou inexistente é recusada', async () => {
        const tx = setup();
        tx.accounts.controlAccountIds.mockResolvedValue(new Set(['imob']));
        await expect(
            resolveDestination(tx, 'c1', presetFixture, 'EXPENSE', 'imob'),
        ).rejects.toMatchObject({ code: 'DESTINATION_ACCOUNT_INVALID' });
        tx.accounts.controlAccountIds.mockResolvedValue(new Set());
        tx.accounts.findRefs.mockResolvedValue([{ ...imobRef, nature: AccountNature.REVENUE }]);
        await expect(
            resolveDestination(tx, 'c1', presetFixture, 'EXPENSE', 'imob'),
        ).rejects.toMatchObject({ code: 'DESTINATION_ACCOUNT_INVALID' });
        tx.accounts.findRefs.mockResolvedValue([]);
        await expect(
            resolveDestination(tx, 'c1', presetFixture, 'EXPENSE', 'imob'),
        ).rejects.toMatchObject({ code: 'DESTINATION_ACCOUNT_INVALID' });
    });
});
