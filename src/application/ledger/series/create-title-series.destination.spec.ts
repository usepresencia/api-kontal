import { CreateTitleSeriesService } from '@/application/ledger/series/create-title-series.service.js';
import { bankRef, fakeClock, fakeUow, presetFixture } from '@test/support/ledger-fakes.js';

const imobRef = { ...bankRef, id: 'imob' };

function setup() {
    const { uow, tx } = fakeUow();
    tx.presets.find.mockResolvedValue(presetFixture);
    tx.accounts.findRefs.mockResolvedValue([imobRef]);
    tx.accounts.controlAccountIds.mockResolvedValue(new Set());
    return { tx, service: new CreateTitleSeriesService(uow, fakeClock) };
}
const input = {
    kind: 'INSTALLMENT' as const,
    presetId: 'pr1',
    type: 'EXPENSE' as const,
    description: 'Máquina',
    amount: 300000,
    expirationDate: new Date('2026-11-30T00:00:00.000Z'),
    count: 3,
    destinationAccountId: 'imob',
};

describe('CreateTitleSeriesService: compra de ativo parcelada', () => {
    it('todas as parcelas usam o destino como conta de resultado', async () => {
        const { tx, service } = setup();
        await service.execute('c1', input);
        const titles = tx.titles.insertAll.mock.calls[0][0] as { resultAccountId: string }[];
        expect(titles).toHaveLength(3);
        expect(titles.every(title => title.resultAccountId === 'imob')).toBe(true);
        expect(tx.accounts.findRefs).toHaveBeenCalledTimes(1);
    });

    it('destino em série a receber é recusado sem gravar', async () => {
        const { tx, service } = setup();
        await expect(service.execute('c1', { ...input, type: 'INCOME' })).rejects.toMatchObject({
            code: 'DESTINATION_ACCOUNT_INVALID',
        });
        expect(tx.series.insert).not.toHaveBeenCalled();
    });
});
