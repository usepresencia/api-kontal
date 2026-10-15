import { CreateTitleService } from '@/application/ledger/titles/create-title.service.js';
import { PresetEntity } from '@/domain/entities/preset.entity.js';
import { fakeClock, fakeUow, presetFixture } from '@test/support/ledger-fakes.js';

const { uow, tx } = fakeUow();
const service = new CreateTitleService(uow, fakeClock);
const input = {
    presetId: 'pr1',
    type: 'INCOME' as const,
    description: ' Venda ',
    amount: 100000,
    expirationDate: new Date('2026-11-01T00:00:00.000Z'),
};

beforeEach(() => {
    tx.presets.find.mockReset().mockResolvedValue(presetFixture);
    tx.titles.insertAll.mockReset();
    tx.journal.writeAll.mockReset();
});

describe('CreateTitleService', () => {
    it('receita: grava o título com as contas do preset e o lançamento de criação', async () => {
        const view = await service.execute('c1', input);
        expect(view.presetName).toBe('Venda de serviços');
        expect(view.title).toMatchObject({
            companyId: 'c1',
            presetId: 'pr1',
            controlAccountId: 'ar',
            resultAccountId: 'rev',
            description: 'Venda',
            status: 'OPEN',
        });
        expect(tx.titles.insertAll).toHaveBeenCalledWith([view.title]);
        const [[journals]] = tx.journal.writeAll.mock.calls;
        expect(journals).toHaveLength(1);
        expect(journals[0]).toMatchObject({
            referenceType: 'TITLE_CREATION',
            referenceId: view.title.id,
            totalDebits: 100000,
        });
    });

    it('despesa: usa a conta a pagar como controle e a de despesa como resultado', async () => {
        const view = await service.execute('c1', { ...input, type: 'EXPENSE' });
        expect(view.title).toMatchObject({ controlAccountId: 'ap', resultAccountId: 'exp' });
    });

    it('sem emissão usa hoje; com emissão informada o lançamento usa essa data', async () => {
        const first = await service.execute('c1', input);
        expect(first.title.issueDate).toEqual(new Date('2026-10-14T00:00:00.000Z'));
        const issueDate = new Date('2026-10-01T00:00:00.000Z');
        const second = await service.execute('c1', { ...input, issueDate });
        expect(tx.journal.writeAll.mock.calls[1][0][0].date).toEqual(issueDate);
        expect(second.title.issueDate).toEqual(issueDate);
    });

    it('preset de outra empresa ou inexistente lança PRESET_NOT_FOUND', async () => {
        tx.presets.find.mockResolvedValue(null);
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'PRESET_NOT_FOUND',
        });
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
    });

    it('preset inativo lança PRESET_INACTIVE', async () => {
        tx.presets.find.mockResolvedValue(
            PresetEntity.fromPersistence({
                ...presetFixture,
                isActive: false,
                accounts: presetFixture.accounts,
            } as never),
        );
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'PRESET_INACTIVE',
        });
    });

    it('preset sem a conta do tipo lança TITLE_NOT_POSTABLE e não grava nada', async () => {
        tx.presets.find.mockResolvedValue(
            PresetEntity.create({
                id: 'pr2',
                billingPlanId: 'p1',
                name: 'Sem receita',
                accounts: { receivable: 'ar', payable: 'ap', expense: 'exp' },
            }),
        );
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'TITLE_NOT_POSTABLE',
        });
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });

    it('dados inválidos não gravam nada', async () => {
        await expect(service.execute('c1', { ...input, amount: 0 })).rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
        });
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
    });
});
