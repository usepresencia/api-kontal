import { CreateEntryService } from '@/application/ledger/entries/create-entry.service.js';
import { PresetEntity } from '@/domain/entities/preset.entity.js';
import {
    fakeClock,
    fakeEntryRead,
    fakeUow,
    bankRef,
    presetFixture,
    titleFixture,
} from '@test/support/ledger-fakes.js';

const { uow, tx } = fakeUow();
const reads = fakeEntryRead();
const service = new CreateEntryService(uow, fakeClock, reads);
const input = {
    billingAccountId: 'bank',
    principal: 30000,
    paidAt: new Date('2026-10-10T00:00:00.000Z'),
    paymentMethod: 'PIX' as const,
};
const rows = (journal: {
    lines: readonly { accountId: string; debit: number; credit: number }[];
}) => journal.lines.map(l => [l.accountId, l.debit, l.credit]);

beforeEach(() => {
    tx.titles.lock.mockReset().mockResolvedValue(titleFixture());
    tx.presets.find.mockReset().mockResolvedValue(presetFixture);
    tx.accounts.findRefs.mockReset().mockResolvedValue([bankRef]);
    tx.entries.insert.mockReset();
    tx.titles.save.mockReset();
    tx.journal.writeAll.mockReset();
    reads.find
        .mockReset()
        .mockResolvedValue({ entry: {}, titleDescription: 'Venda', billingAccountName: 'Banco' });
});

describe('CreateEntryService: receita', () => {
    it('pagamento parcial: D conta da baixa / C a receber, abate o saldo e mantém em aberto', async () => {
        const view = await service.execute('c1', 't1', input);
        expect(tx.accounts.findRefs).toHaveBeenCalledWith('c1', ['bank']);
        const [entry] = tx.entries.insert.mock.calls[0];
        expect(entry).toMatchObject({
            titleId: 't1',
            kind: 'PAYMENT',
            principalAmount: 30000,
            totalAmount: 30000,
        });
        expect(tx.titles.save.mock.calls[0][0]).toMatchObject({
            settledAmount: 30000,
            status: 'OPEN',
        });
        const [[journals]] = tx.journal.writeAll.mock.calls;
        expect(journals[0]).toMatchObject({
            referenceType: 'SETTLEMENT',
            referenceId: entry.id,
            date: input.paidAt,
        });
        expect(rows(journals[0])).toEqual([
            ['bank', 30000, 0],
            ['ar', 0, 30000],
        ]);
        expect(reads.find).toHaveBeenCalledWith('c1', entry.id);
        expect(view.billingAccountName).toBe('Banco');
    });

    it('pagamento do saldo inteiro quita o título', async () => {
        await service.execute('c1', 't1', { ...input, principal: 100000 });
        expect(tx.titles.save.mock.calls[0][0]).toMatchObject({
            status: 'SETTLED',
            settledAmount: 100000,
        });
    });

    it('com juros, multa e desconto: total, linhas balanceadas e principal abatido', async () => {
        await service.execute('c1', 't1', {
            ...input,
            principal: 100000,
            interest: 5000,
            fine: 2000,
            discount: 3000,
        });
        const [entry] = tx.entries.insert.mock.calls[0];
        expect(entry.totalAmount).toBe(104000);
        const [[journals]] = tx.journal.writeAll.mock.calls;
        expect(rows(journals[0])).toEqual([
            ['bank', 104000, 0],
            ['dc', 3000, 0],
            ['ar', 0, 100000],
            ['jr', 0, 7000],
        ]);
        expect(journals[0].totalDebits).toBe(journals[0].totalCredits);
        expect(tx.titles.save.mock.calls[0][0].settledAmount).toBe(100000);
    });
});

describe('CreateEntryService: despesa', () => {
    it('D a pagar / C conta da baixa', async () => {
        tx.titles.lock.mockResolvedValue(
            titleFixture({ type: 'EXPENSE', controlAccountId: 'ap', resultAccountId: 'exp' }),
        );
        await service.execute('c1', 't1', input);
        expect(rows(tx.journal.writeAll.mock.calls[0][0][0])).toEqual([
            ['ap', 30000, 0],
            ['bank', 0, 30000],
        ]);
    });
});

describe('CreateEntryService: recusas (nada é gravado)', () => {
    const nothingWritten = () => {
        expect(tx.entries.insert).not.toHaveBeenCalled();
        expect(tx.titles.save).not.toHaveBeenCalled();
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    };

    it('título de outra empresa ou inexistente lança TITLE_NOT_FOUND', async () => {
        tx.titles.lock.mockResolvedValue(null);
        await expect(service.execute('c1', 'x', input)).rejects.toMatchObject({
            code: 'TITLE_NOT_FOUND',
        });
        nothingWritten();
    });

    it('preset inexistente lança PRESET_NOT_FOUND', async () => {
        tx.presets.find.mockResolvedValue(null);
        await expect(service.execute('c1', 't1', input)).rejects.toMatchObject({
            code: 'PRESET_NOT_FOUND',
        });
        nothingWritten();
    });

    it.each([
        ['conta que não é da empresa', []],
        ['conta de outro plano', [{ ...bankRef, billingPlanId: 'p2' }]],
        ['conta sintética', [{ ...bankRef, accountType: 'SYNTHETIC' }]],
        ['conta de receita', [{ ...bankRef, nature: 'REVENUE' }]],
        ['a própria conta de controle', [{ ...bankRef, id: 'bank' }]],
    ])('%s lança ENTRY_ACCOUNT_INVALID', async (label, refs) => {
        if (label === 'a própria conta de controle') {
            tx.titles.lock.mockResolvedValue(titleFixture({ controlAccountId: 'bank' }));
        }
        tx.accounts.findRefs.mockResolvedValue(refs);
        await expect(service.execute('c1', 't1', input)).rejects.toMatchObject({
            code: 'ENTRY_ACCOUNT_INVALID',
        });
        nothingWritten();
    });

    it('pagamento acima do saldo lança ENTRY_EXCEEDS_BALANCE', async () => {
        await expect(
            service.execute('c1', 't1', { ...input, principal: 100001 }),
        ).rejects.toMatchObject({ code: 'ENTRY_EXCEEDS_BALANCE' });
        nothingWritten();
    });

    it('título quitado lança TITLE_NOT_OPEN', async () => {
        tx.titles.lock.mockResolvedValue(
            titleFixture({ status: 'SETTLED', settledAmount: 100000 }),
        );
        await expect(service.execute('c1', 't1', input)).rejects.toMatchObject({
            code: 'TITLE_NOT_OPEN',
        });
        nothingWritten();
    });

    it.each([
        ['data futura', { paidAt: new Date('2026-10-15T00:00:00.000Z') }, 'ENTRY_DATE_INVALID'],
        [
            'data anterior à emissão',
            { paidAt: new Date('2026-09-30T00:00:00.000Z') },
            'ENTRY_DATE_INVALID',
        ],
        ['desconto acima do principal', { discount: 30001 }, 'ENTRY_AMOUNT_INVALID'],
        ['principal zero', { principal: 0 }, 'ENTRY_AMOUNT_INVALID'],
    ])('%s lança %s', async (_label, overrides, code) => {
        await expect(service.execute('c1', 't1', { ...input, ...overrides })).rejects.toMatchObject(
            { code },
        );
        nothingWritten();
    });

    it('juros sem conta de juros no preset lança SETTLEMENT_NOT_POSTABLE', async () => {
        tx.presets.find.mockResolvedValue(
            PresetEntity.create({
                id: 'pr2',
                billingPlanId: 'p1',
                name: 'x',
                accounts: { receivable: 'ar', payable: 'ap', revenue: 'rev' },
            }),
        );
        await expect(
            service.execute('c1', 't1', { ...input, interest: 100 }),
        ).rejects.toMatchObject({ code: 'SETTLEMENT_NOT_POSTABLE' });
        nothingWritten();
    });
});
