import { UpdateTitleService } from '@/application/ledger/titles/update-title.service.js';
import { fakeTitleRead, fakeUow, titleFixture } from '@test/support/ledger-fakes.js';

const { uow, tx } = fakeUow();
const reads = fakeTitleRead();
const service = new UpdateTitleService(uow, reads);

beforeEach(() => {
    tx.titles.lock.mockReset().mockResolvedValue(titleFixture());
    tx.titles.save.mockReset();
    reads.find.mockReset().mockResolvedValue({ title: titleFixture(), presetName: 'Preset' });
});

describe('UpdateTitleService', () => {
    it('trava o título, altera os campos editáveis, grava e devolve a leitura', async () => {
        const view = await service.execute('c1', 't1', {
            description: 'Novo',
            expirationDate: new Date('2026-12-01T00:00:00.000Z'),
            feesPercentageMonthly: 0.1,
        });
        expect(tx.titles.lock).toHaveBeenCalledWith('c1', 't1');
        expect(tx.titles.save.mock.calls[0][0]).toMatchObject({
            description: 'Novo',
            feesPercentageMonthly: 0.1,
            amount: 100000,
        });
        expect(view.presetName).toBe('Preset');
    });

    it('campos travados iguais aos atuais são aceitos; diferentes lançam TITLE_FIELD_LOCKED', async () => {
        await expect(
            service.execute('c1', 't1', {
                description: 'x',
                locked: { type: 'INCOME', amount: 100000, presetId: 'pr1' },
            }),
        ).resolves.toBeDefined();
        await expect(service.execute('c1', 't1', { locked: { amount: 5 } })).rejects.toMatchObject({
            code: 'TITLE_FIELD_LOCKED',
        });
        await expect(
            service.execute('c1', 't1', { locked: { type: 'EXPENSE' } }),
        ).rejects.toMatchObject({ code: 'TITLE_FIELD_LOCKED' });
    });

    it('título de outra empresa ou inexistente lança TITLE_NOT_FOUND', async () => {
        tx.titles.lock.mockResolvedValue(null);
        await expect(service.execute('c1', 'x', { description: 'a' })).rejects.toMatchObject({
            code: 'TITLE_NOT_FOUND',
        });
        expect(tx.titles.save).not.toHaveBeenCalled();
    });

    it('valor inválido não grava', async () => {
        await expect(
            service.execute('c1', 't1', { feesPercentageMonthly: 2 }),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(tx.titles.save).not.toHaveBeenCalled();
    });
});
