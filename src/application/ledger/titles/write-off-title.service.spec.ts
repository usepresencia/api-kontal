import { WriteOffTitleService } from '@/application/ledger/titles/write-off-title.service.js';
import { PresetEntity } from '@/domain/entities/preset.entity.js';
import { fakeClock, fakeUow, presetFixture, titleFixture } from '@test/support/ledger-fakes.js';

const { uow, tx } = fakeUow();
const service = new WriteOffTitleService(uow, fakeClock);

beforeEach(() => {
    tx.titles.lock.mockReset().mockResolvedValue(titleFixture({ settledAmount: 30000 }));
    tx.presets.find.mockReset().mockResolvedValue(presetFixture);
    tx.entries.insert.mockReset();
    tx.titles.save.mockReset();
    tx.journal.writeAll.mockReset();
});

describe('WriteOffTitleService', () => {
    it('receita: baixa o saldo em aberto como perda (D perda / C a receber) e marca o título', async () => {
        const view = await service.execute('c1', 't1', {});
        expect(view.entry).toMatchObject({
            kind: 'WRITE_OFF',
            principalAmount: 70000,
            totalAmount: 0,
            billingAccountId: null,
        });
        expect(view.titleDescription).toBe('Venda');
        expect(view.billingAccountName).toBeNull();
        expect(tx.titles.save.mock.calls[0][0]).toMatchObject({
            status: 'WRITTEN_OFF',
            settledAmount: 100000,
        });
        const [[journals]] = tx.journal.writeAll.mock.calls;
        expect(journals[0]).toMatchObject({
            referenceType: 'SETTLEMENT',
            referenceId: view.entry.id,
            date: new Date('2026-10-14T00:00:00.000Z'),
        });
        expect(
            journals[0].lines.map((l: { accountId: string; debit: number; credit: number }) => [
                l.accountId,
                l.debit,
                l.credit,
            ]),
        ).toEqual([
            ['pd', 70000, 0],
            ['ar', 0, 70000],
        ]);
    });

    it('despesa: D a pagar / C perdão de dívida', async () => {
        tx.titles.lock.mockResolvedValue(
            titleFixture({ type: 'EXPENSE', controlAccountId: 'ap', resultAccountId: 'exp' }),
        );
        await service.execute('c1', 't1', {});
        expect(
            tx.journal.writeAll.mock.calls[0][0][0].lines.map(
                (l: { accountId: string; debit: number; credit: number }) => [
                    l.accountId,
                    l.debit,
                    l.credit,
                ],
            ),
        ).toEqual([
            ['ap', 100000, 0],
            ['pf', 0, 100000],
        ]);
    });

    it('respeita data e descrição informadas', async () => {
        const paidAt = new Date('2026-10-05T00:00:00.000Z');
        const view = await service.execute('c1', 't1', { paidAt, description: 'Cliente sumiu' });
        expect(view.entry).toMatchObject({ paidAt, description: 'Cliente sumiu' });
    });

    it('título quitado ou já baixado lança TITLE_NOT_OPEN e não grava nada', async () => {
        tx.titles.lock.mockResolvedValue(
            titleFixture({ status: 'SETTLED', settledAmount: 100000 }),
        );
        await expect(service.execute('c1', 't1', {})).rejects.toMatchObject({
            code: 'TITLE_NOT_OPEN',
        });
        expect(tx.entries.insert).not.toHaveBeenCalled();
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });

    it('preset sem a conta de perda lança SETTLEMENT_NOT_POSTABLE e não grava nada', async () => {
        tx.presets.find.mockResolvedValue(
            PresetEntity.create({
                id: 'pr2',
                billingPlanId: 'p1',
                name: 'x',
                accounts: { receivable: 'ar', payable: 'ap', revenue: 'rev' },
            }),
        );
        await expect(service.execute('c1', 't1', {})).rejects.toMatchObject({
            code: 'SETTLEMENT_NOT_POSTABLE',
        });
        expect(tx.entries.insert).not.toHaveBeenCalled();
        expect(tx.titles.save).not.toHaveBeenCalled();
    });

    it('título inexistente lança TITLE_NOT_FOUND e preset inexistente lança PRESET_NOT_FOUND', async () => {
        tx.titles.lock.mockResolvedValue(null);
        await expect(service.execute('c1', 'x', {})).rejects.toMatchObject({
            code: 'TITLE_NOT_FOUND',
        });
        tx.titles.lock.mockResolvedValue(titleFixture());
        tx.presets.find.mockResolvedValue(null);
        await expect(service.execute('c1', 't1', {})).rejects.toMatchObject({
            code: 'PRESET_NOT_FOUND',
        });
    });

    it('data da baixa futura lança ENTRY_DATE_INVALID', async () => {
        await expect(
            service.execute('c1', 't1', { paidAt: new Date('2026-10-15T00:00:00.000Z') }),
        ).rejects.toMatchObject({ code: 'ENTRY_DATE_INVALID' });
    });
});
