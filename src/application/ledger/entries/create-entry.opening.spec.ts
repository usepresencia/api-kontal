import { CreateEntryService } from '@/application/ledger/entries/create-entry.service.js';
import {
    bankRef,
    fakeClock,
    fakeEntryRead,
    fakeUow,
    presetFixture,
    titleFixture,
} from '@test/support/ledger-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function setup() {
    const { uow, tx } = fakeUow();
    const reads = fakeEntryRead();
    tx.titles.lock.mockResolvedValue(
        titleFixture({
            issueDate: day('2026-01-10'),
            isOpening: true,
            openingDate: day('2026-10-05'),
        }),
    );
    tx.presets.find.mockResolvedValue(presetFixture);
    tx.accounts.findRefs.mockResolvedValue([bankRef]);
    reads.find.mockResolvedValue({
        entry: {},
        titleDescription: 'x',
        titleType: 'INCOME',
        billingAccountName: 'Banco',
    });
    return { tx, service: new CreateEntryService(uow, fakeClock, reads) };
}
const payment = (paidAt: Date) => ({
    billingAccountId: 'bank',
    principal: 10000,
    paidAt,
    paymentMethod: 'PIX' as const,
});

describe('CreateEntryService: título de implantação', () => {
    it('baixa antes da implantação é recusada, mesmo depois da emissão original', async () => {
        const { tx, service } = setup();
        await expect(service.execute('c1', 't1', payment(day('2026-10-04')))).rejects.toMatchObject(
            { code: 'ENTRY_DATE_INVALID' },
        );
        expect(tx.entries.insert).not.toHaveBeenCalled();
    });

    it('baixa na data de implantação é aceita', async () => {
        const { tx, service } = setup();
        await service.execute('c1', 't1', payment(day('2026-10-05')));
        expect(tx.entries.insert).toHaveBeenCalledTimes(1);
    });
});
