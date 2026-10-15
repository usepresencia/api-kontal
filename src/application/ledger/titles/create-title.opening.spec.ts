import { CreateTitleService } from '@/application/ledger/titles/create-title.service.js';
import { PresetEntity } from '@/domain/entities/preset.entity.js';
import { fakeClock, fakeUow, presetFixture } from '@test/support/ledger-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const withOpening = PresetEntity.create({
    id: 'pr3',
    billingPlanId: 'p1',
    name: 'Com saldos iniciais',
    accounts: { receivable: 'ar', payable: 'ap', openingBalance: 'open' },
});
const input = {
    presetId: 'pr3',
    type: 'INCOME' as const,
    description: 'Cliente antigo',
    amount: 100000,
    issueDate: day('2026-01-10'),
    expirationDate: day('2026-12-01'),
    isOpening: true,
    openingDate: day('2026-10-01'),
    settledAmount: 40000,
};

function setup(preset = withOpening) {
    const { uow, tx } = fakeUow();
    tx.presets.find.mockResolvedValue(preset);
    return { tx, service: new CreateTitleService(uow, fakeClock) };
}

describe('CreateTitleService: implantação', () => {
    it('usa a conta de saldos iniciais como resultado e lança só o saldo em aberto na data de implantação', async () => {
        const { tx, service } = setup();
        await service.execute('c1', input);
        const [[title]] = tx.titles.insertAll.mock.calls[0];
        expect(title).toMatchObject({
            isOpening: true,
            resultAccountId: 'open',
            controlAccountId: 'ar',
            settledAmount: 40000,
        });
        const [[journal]] = tx.journal.writeAll.mock.calls[0];
        expect(journal.date).toEqual(day('2026-10-01'));
        expect(journal.totalDebits).toBe(60000);
    });

    it('preset sem a conta de saldos iniciais responde TITLE_NOT_POSTABLE', async () => {
        const { tx, service } = setup(presetFixture);
        await expect(service.execute('c1', { ...input, presetId: 'pr1' })).rejects.toMatchObject({
            code: 'TITLE_NOT_POSTABLE',
        });
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
    });

    it('destino junto de implantação é recusado', async () => {
        const { service } = setup();
        await expect(
            service.execute('c1', { ...input, type: 'EXPENSE', destinationAccountId: 'imob' }),
        ).rejects.toMatchObject({
            code: 'DESTINATION_ACCOUNT_INVALID',
        });
    });

    it('campos inconsistentes são recusados antes de gravar', async () => {
        const { tx, service } = setup();
        await expect(
            service.execute('c1', { ...input, openingDate: undefined }),
        ).rejects.toMatchObject({ code: 'OPENING_TITLE_INVALID' });
        await expect(
            service.execute('c1', { ...input, isOpening: undefined }),
        ).rejects.toMatchObject({ code: 'OPENING_TITLE_INVALID' });
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
    });
});
