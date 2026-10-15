import { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';

const base = {
    id: 'j1',
    companyId: 'c1',
    date: new Date('2026-10-14T00:00:00.000Z'),
    description: 'Título: Aluguel - criação',
    referenceType: JournalRefType.TITLE_CREATION,
    referenceId: 't1',
};
const debit = (accountId: string, amount: number) => ({
    accountId,
    debit: amount,
    credit: 0,
    memo: '',
});
const credit = (accountId: string, amount: number) => ({
    accountId,
    debit: 0,
    credit: amount,
    memo: '',
});
const invalid = { code: 'JOURNAL_INVALID' };

describe('JournalEntryEntity.create', () => {
    it('aceita lançamento balanceado e calcula os totais', () => {
        const entry = JournalEntryEntity.create({
            ...base,
            lines: [debit('a', 1000), debit('b', 500), credit('c', 1500)],
        });
        expect(entry).toMatchObject({ totalDebits: 1500, totalCredits: 1500, id: 'j1' });
        expect(entry.lines).toHaveLength(3);
    });

    it.each([
        ['uma linha só', [debit('a', 100)]],
        ['sem linhas', []],
        ['débito diferente do crédito', [debit('a', 100), credit('b', 90)]],
        [
            'linha com débito e crédito',
            [{ accountId: 'a', debit: 50, credit: 50, memo: '' }, credit('b', 0)],
        ],
        [
            'linha zerada',
            [debit('a', 100), credit('b', 100), { accountId: 'c', debit: 0, credit: 0, memo: '' }],
        ],
        ['valor negativo', [debit('a', -100), credit('b', -100)]],
        ['valor fracionado', [debit('a', 10.5), credit('b', 10.5)]],
    ])('rejeita %s com JOURNAL_INVALID', (_label, lines) => {
        expect(() => JournalEntryEntity.create({ ...base, lines })).toThrow(
            expect.objectContaining(invalid),
        );
    });
});

describe('JournalEntryEntity.fromPersistence', () => {
    it('reidrata sem revalidar', () => {
        const createdAt = new Date('2026-01-01');
        const entry = JournalEntryEntity.fromPersistence({
            ...base,
            totalDebits: 100,
            totalCredits: 100,
            lines: [debit('a', 100), credit('b', 100)],
            createdAt,
        });
        expect(entry.createdAt).toBe(createdAt);
        expect(entry.totalDebits).toBe(100);
    });
});
