import { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import {
    toJournalData,
    toJournalEntity,
} from '@/infrastructure/persistence/journal.prisma.mapper.js';

const dec = (text: string) => ({ toFixed: () => text });
const date = new Date('2026-10-14T00:00:00.000Z');

const entry = JournalEntryEntity.create({
    id: 'j1',
    companyId: 'c1',
    date,
    description: 'Criação',
    referenceType: 'TITLE_CREATION',
    referenceId: 't1',
    lines: [
        { accountId: 'a', debit: 150050, credit: 0, memo: 'm1' },
        { accountId: 'b', debit: 0, credit: 150050, memo: 'm2' },
    ],
});

describe('journal.prisma.mapper', () => {
    it('toJournalData separa o lançamento e as linhas com valores Decimal', () => {
        const { entry: row, lines } = toJournalData(entry);
        expect(row).toMatchObject({
            id: 'j1',
            companyId: 'c1',
            date,
            referenceType: 'TITLE_CREATION',
            referenceId: 't1',
        });
        expect(row.totalDebits.toFixed(2)).toBe('1500.50');
        expect(row.totalCredits.toFixed(2)).toBe('1500.50');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatchObject({ journalEntryId: 'j1', accountId: 'a', memo: 'm1' });
        expect(lines[0].debit.toFixed(2)).toBe('1500.50');
        expect(lines[1].credit.toFixed(2)).toBe('1500.50');
    });

    it('toJournalEntity reidrata o lançamento com os valores em centavos', () => {
        const createdAt = new Date('2026-01-01');
        const restored = toJournalEntity({
            id: 'j1',
            companyId: 'c1',
            date,
            description: 'Criação',
            referenceType: 'TITLE_CREATION',
            referenceId: 't1',
            totalDebits: dec('1500.50'),
            totalCredits: dec('1500.50'),
            createdAt,
            lines: [
                {
                    id: 'l1',
                    journalEntryId: 'j1',
                    accountId: 'a',
                    debit: dec('1500.50'),
                    credit: dec('0.00'),
                    memo: 'm1',
                },
                {
                    id: 'l2',
                    journalEntryId: 'j1',
                    accountId: 'b',
                    debit: dec('0.00'),
                    credit: dec('1500.50'),
                    memo: 'm2',
                },
            ],
        } as never);
        expect(restored).toMatchObject({
            id: 'j1',
            totalDebits: 150050,
            totalCredits: 150050,
            createdAt,
        });
        expect(restored.lines).toEqual([
            { accountId: 'a', debit: 150050, credit: 0, memo: 'm1' },
            { accountId: 'b', debit: 0, credit: 150050, memo: 'm2' },
        ]);
    });
});
