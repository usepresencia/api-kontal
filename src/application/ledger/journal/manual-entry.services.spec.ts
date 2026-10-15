import { CreateManualEntryService } from '@/application/ledger/journal/create-manual-entry.service.js';
import { ReverseManualEntryService } from '@/application/ledger/journal/reverse-manual-entry.service.js';
import type { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import {
    bankRef,
    fakeClock,
    fakeJournalRead,
    fakeUow,
    journalFixture,
    journalViewFixture,
    TODAY,
} from '@test/support/ledger-fakes.js';

const capitalRef = { ...bankRef, id: 'capital' };
const input = {
    date: new Date('2026-10-10T00:00:00.000Z'),
    description: 'Aporte de capital',
    lines: [
        { accountId: 'bank', debit: 100000 },
        { accountId: 'capital', credit: 100000, memo: 'sócio A' },
    ],
};

describe('CreateManualEntryService', () => {
    function setup() {
        const { uow, tx } = fakeUow();
        const reads = fakeJournalRead();
        tx.accounts.findRefs.mockResolvedValue([bankRef, capitalRef]);
        tx.accounts.controlAccountIds.mockResolvedValue(new Set());
        reads.find.mockImplementation(async () =>
            journalViewFixture(tx.journal.writeAll.mock.calls[0][0][0] as JournalEntryEntity, {
                number: 1,
            }),
        );
        return { tx, reads, service: new CreateManualEntryService(uow, fakeClock, reads) };
    }

    it('valida contas e grava o lançamento MANUAL na transação; devolve a visão de leitura', async () => {
        const { tx, reads, service } = setup();
        const view = await service.execute('c1', input);
        expect(tx.accounts.findRefs).toHaveBeenCalledWith('c1', ['bank', 'capital']);
        expect(tx.accounts.controlAccountIds).toHaveBeenCalledWith('c1', ['bank', 'capital']);
        const [entry] = tx.journal.writeAll.mock.calls[0][0] as JournalEntryEntity[];
        expect(entry).toMatchObject({
            referenceType: 'MANUAL',
            referenceId: entry.id,
            companyId: 'c1',
            totalDebits: 100000,
        });
        expect(entry.lines).toEqual([
            { accountId: 'bank', debit: 100000, credit: 0, memo: '' },
            { accountId: 'capital', debit: 0, credit: 100000, memo: 'sócio A' },
        ]);
        expect(reads.find).toHaveBeenCalledWith('c1', entry.id);
        expect(view.entry).toBe(entry);
    });

    it.each([
        [
            'data futura',
            { ...input, date: new Date(TODAY.getTime() + 86_400_000) },
            'MANUAL_ENTRY_DATE_INVALID',
        ],
        [
            'desbalanceado',
            {
                ...input,
                lines: [
                    { accountId: 'bank', debit: 100 },
                    { accountId: 'capital', credit: 99 },
                ],
            },
            'MANUAL_ENTRY_UNBALANCED',
        ],
    ])('recusa %s antes de abrir a transação', async (_label, body, code) => {
        const { tx, service } = setup();
        await expect(service.execute('c1', body)).rejects.toMatchObject({ code });
        expect(tx.accounts.findRefs).not.toHaveBeenCalled();
    });

    it('recusa conta de controle sem gravar', async () => {
        const { tx, service } = setup();
        tx.accounts.controlAccountIds.mockResolvedValue(new Set(['bank']));
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'MANUAL_ENTRY_CONTROL_ACCOUNT',
        });
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });

    it('recusa conta inexistente ou de outra empresa sem gravar', async () => {
        const { tx, service } = setup();
        tx.accounts.findRefs.mockResolvedValue([bankRef]);
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'MANUAL_ENTRY_ACCOUNT_INVALID',
        });
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });
});

describe('ReverseManualEntryService', () => {
    const original = journalFixture(
        'MANUAL',
        'm1',
        [
            { accountId: 'bank', debit: 100000, credit: 0, memo: '' },
            { accountId: 'capital', debit: 0, credit: 100000, memo: '' },
        ],
        new Date('2026-10-01T00:00:00.000Z'),
    );

    function setup() {
        const { uow, tx } = fakeUow();
        const reads = fakeJournalRead();
        tx.journal.lock.mockResolvedValue(original);
        tx.journal.find.mockResolvedValue(null);
        reads.find.mockImplementation(async () =>
            journalViewFixture(tx.journal.writeAll.mock.calls[0][0][0] as JournalEntryEntity),
        );
        return { tx, reads, service: new ReverseManualEntryService(uow, fakeClock, reads) };
    }

    it('trava o original, confere que não foi estornado e grava o estorno com data de hoje', async () => {
        const { tx, service } = setup();
        const view = await service.execute('c1', original.id, {
            description: 'Lançado em duplicidade',
        });
        expect(tx.journal.lock).toHaveBeenCalledWith('c1', original.id);
        expect(tx.journal.find).toHaveBeenCalledWith('MANUAL_REVERSAL', original.id);
        expect(view.entry).toMatchObject({
            referenceType: 'MANUAL_REVERSAL',
            referenceId: original.id,
            date: TODAY,
            description: 'Lançado em duplicidade',
        });
    });

    it('lançamento de outra empresa: JOURNAL_ENTRY_NOT_FOUND', async () => {
        const { tx, service } = setup();
        tx.journal.lock.mockResolvedValue(null);
        await expect(service.execute('c1', 'x', {})).rejects.toMatchObject({
            code: 'JOURNAL_ENTRY_NOT_FOUND',
        });
    });

    it('lançamento automático: JOURNAL_NOT_REVERSIBLE; já estornado: JOURNAL_ALREADY_REVERSED', async () => {
        const { tx, service } = setup();
        tx.journal.lock.mockResolvedValueOnce(journalFixture('SETTLEMENT', 'e1', original.lines));
        await expect(service.execute('c1', 'j-e1', {})).rejects.toMatchObject({
            code: 'JOURNAL_NOT_REVERSIBLE',
        });
        tx.journal.find.mockResolvedValueOnce(original);
        await expect(service.execute('c1', original.id, {})).rejects.toMatchObject({
            code: 'JOURNAL_ALREADY_REVERSED',
        });
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });
});
