import { ReopenPeriodService } from '@/application/ledger/periods/reopen-period.service.js';
import { journalFixture, fakeUow } from '@test/support/ledger-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const row = (id: string, throughDate: string, closingEntryId: string | null = null) => ({
    id,
    companyId: 'c1',
    throughDate: day(throughDate),
    closingEntryId,
    createdAt: new Date(),
});

function setup() {
    const { uow, tx } = fakeUow();
    tx.periods.lockCompany.mockResolvedValue({ closedThrough: day('2026-11-30') });
    return { tx, service: new ReopenPeriodService(uow) };
}

describe('ReopenPeriodService', () => {
    it('reabre o último mês comum: apaga o registro e volta a trava ao fechamento anterior', async () => {
        const { tx, service } = setup();
        tx.periods.latest
            .mockResolvedValueOnce(row('p2', '2026-11-30'))
            .mockResolvedValueOnce(row('p1', '2026-10-31'));
        await service.execute('c1');
        expect(tx.periods.lockCompany).toHaveBeenCalledWith('c1');
        expect(tx.periods.delete).toHaveBeenCalledWith('p2');
        expect(tx.periods.setClosedThrough).toHaveBeenCalledWith('c1', day('2026-10-31'));
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });

    it('sem fechamento anterior a trava volta a nulo', async () => {
        const { tx, service } = setup();
        tx.periods.latest
            .mockResolvedValueOnce(row('p1', '2026-10-31'))
            .mockResolvedValueOnce(null);
        await service.execute('c1');
        expect(tx.periods.setClosedThrough).toHaveBeenCalledWith('c1', null);
    });

    it('com apuração, estorna o lançamento na mesma data antes de apagar o fechamento', async () => {
        const { tx, service } = setup();
        const original = journalFixture(
            'CLOSING',
            'cl1',
            [
                { accountId: 'rev', debit: 100, credit: 0, memo: '' },
                { accountId: 'ret', debit: 0, credit: 100, memo: '' },
            ],
            day('2026-12-31'),
        );
        tx.periods.latest
            .mockResolvedValueOnce(row('cl1', '2026-12-31', original.id))
            .mockResolvedValueOnce(null);
        tx.journal.find.mockResolvedValue(original);
        await service.execute('c1');
        expect(tx.journal.find).toHaveBeenCalledWith('CLOSING', 'cl1');
        const [[reversal]] = tx.journal.writeAll.mock.calls[0];
        expect(reversal).toMatchObject({
            referenceType: 'CLOSING_REVERSAL',
            referenceId: original.referenceId,
            date: day('2026-12-31'),
        });
        expect(tx.periods.delete).toHaveBeenCalledWith('cl1');
    });

    it('apuração que sumiu é erro interno e nada é apagado', async () => {
        const { tx, service } = setup();
        tx.periods.latest.mockResolvedValueOnce(row('cl1', '2026-12-31', 'e1'));
        tx.journal.find.mockResolvedValue(null);
        await expect(service.execute('c1')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
        expect(tx.periods.delete).not.toHaveBeenCalled();
    });

    it('sem fechamento responde PERIOD_CLOSING_NOT_FOUND; empresa inexistente, COMPANY_NOT_FOUND', async () => {
        const { tx, service } = setup();
        tx.periods.latest.mockResolvedValue(null);
        await expect(service.execute('c1')).rejects.toMatchObject({
            code: 'PERIOD_CLOSING_NOT_FOUND',
        });
        tx.periods.lockCompany.mockResolvedValue(null);
        await expect(service.execute('c1')).rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND' });
    });
});
