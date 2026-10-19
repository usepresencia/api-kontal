import { CreateTitleService } from '@/application/ledger/titles/create-title.service.js';
import { PresetEntity } from '@/domain/entities/preset.entity.js';
import { bankRef, fakeClock, fakeUow, presetFixture } from '@test/support/ledger-fakes.js';

const imobRef = { ...bankRef, id: 'imob' };
const input = {
    presetId: 'pr1',
    type: 'EXPENSE' as const,
    description: 'Compra de equipamento',
    amount: 500000,
    expirationDate: new Date('2026-11-30T00:00:00.000Z'),
    destinationAccountId: 'imob',
};

function setup(preset = presetFixture) {
    const { uow, tx } = fakeUow();
    tx.presets.find.mockResolvedValue(preset);
    tx.accounts.findRefs.mockResolvedValue([imobRef]);
    tx.accounts.controlAccountIds.mockResolvedValue(new Set());
    return { tx, service: new CreateTitleService(uow, fakeClock) };
}

describe('CreateTitleService: compra de ativo', () => {
    it('grava o destino em resultAccountId e lança D ativo / C a pagar', async () => {
        const { tx, service } = setup();
        await service.execute('c1', input);
        const [[title]] = tx.titles.insertAll.mock.calls[0];
        expect(title).toMatchObject({ controlAccountId: 'ap', resultAccountId: 'imob' });
        const [[journal]] = tx.journal.writeAll.mock.calls[0];
        expect(
            journal.lines.map((line: { accountId: string; debit: number; credit: number }) => [
                line.accountId,
                line.debit,
                line.credit,
            ]),
        ).toEqual([
            ['imob', 500000, 0],
            ['ap', 0, 500000],
        ]);
    });

    it('preset sem conta de despesa aceita o destino', async () => {
        const preset = PresetEntity.create({
            id: 'pr2',
            billingPlanId: 'p1',
            name: 'Sem despesa',
            accounts: { receivable: 'ar', payable: 'ap' },
        });
        const { tx, service } = setup(preset);
        await service.execute('c1', input);
        expect(tx.titles.insertAll.mock.calls[0][0][0]).toMatchObject({ resultAccountId: 'imob' });
    });

    it('sem destino mantém a conta de despesa do preset', async () => {
        const { tx, service } = setup();
        const { destinationAccountId: _destination, ...withoutDestination } = input;
        await service.execute('c1', withoutDestination);
        expect(tx.titles.insertAll.mock.calls[0][0][0]).toMatchObject({ resultAccountId: 'exp' });
        expect(tx.accounts.findRefs).not.toHaveBeenCalled();
    });

    it('destino recusado não grava nada', async () => {
        const { tx, service } = setup();
        tx.accounts.controlAccountIds.mockResolvedValue(new Set(['imob']));
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'DESTINATION_ACCOUNT_INVALID',
        });
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });
});
