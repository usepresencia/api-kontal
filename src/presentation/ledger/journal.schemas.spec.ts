import {
    createManualEntrySchema,
    listJournalEntriesQuerySchema,
    reverseManualEntrySchema,
} from '@/presentation/ledger/journal.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';

describe('listJournalEntriesQuerySchema', () => {
    it('combina paginação com os filtros e converte as datas', () => {
        expect(listJournalEntriesQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
        expect(
            listJournalEntriesQuerySchema.parse({
                from: '2026-10-01',
                to: '2026-10-31',
                referenceType: 'MANUAL',
                referenceId: 'abc',
                accountId: uuid,
                page: '2',
            }),
        ).toEqual({
            from: new Date('2026-10-01T00:00:00.000Z'),
            to: new Date('2026-10-31T00:00:00.000Z'),
            referenceType: 'MANUAL',
            referenceId: 'abc',
            accountId: uuid,
            page: 2,
            pageSize: 10,
        });
    });

    it.each([
        { from: 'ontem' },
        { to: '31/10/2026' },
        { referenceType: 'OUTRO' },
        { referenceId: '' },
        { referenceId: 'x'.repeat(65) },
        { accountId: 'x' },
        { pageSize: '101' },
    ])('rejeita %j', query => {
        expect(listJournalEntriesQuerySchema.safeParse(query).success).toBe(false);
    });
});

describe('createManualEntrySchema', () => {
    const uuidA = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
    const uuidB = '4a7e1b3f-9c2d-4e6f-8b1a-2d3c4b5e6f70';
    const valid = {
        date: '2026-10-10',
        description: 'Aporte',
        lines: [
            { accountId: uuidA, debit: '1000.00' },
            { accountId: uuidB, credit: '1000.00', memo: 'sócio' },
        ],
    };

    it('converte data e valores em centavos', () => {
        expect(createManualEntrySchema.parse(valid)).toEqual({
            date: new Date('2026-10-10T00:00:00.000Z'),
            description: 'Aporte',
            lines: [
                { accountId: uuidA, debit: 100000 },
                { accountId: uuidB, credit: 100000, memo: 'sócio' },
            ],
        });
    });

    it.each([
        ['sem histórico', { ...valid, description: '   ' }],
        ['uma linha', { ...valid, lines: [valid.lines[0]] }],
        ['51 linhas', { ...valid, lines: Array.from({ length: 51 }, () => valid.lines[0]) }],
        [
            'linha com débito e crédito',
            { ...valid, lines: [{ accountId: uuidA, debit: '1', credit: '1' }, valid.lines[1]] },
        ],
        ['linha sem valor', { ...valid, lines: [{ accountId: uuidA }, valid.lines[1]] }],
        [
            'linha zerada',
            { ...valid, lines: [{ accountId: uuidA, debit: '0.00' }, valid.lines[1]] },
        ],
        [
            'valor com 3 casas',
            { ...valid, lines: [{ accountId: uuidA, debit: '1.001' }, valid.lines[1]] },
        ],
        [
            'conta que não é UUID',
            { ...valid, lines: [{ accountId: 'x', debit: '1' }, valid.lines[1]] },
        ],
    ])('rejeita %s', (_label, body) => {
        expect(createManualEntrySchema.safeParse(body).success).toBe(false);
    });
});

describe('reverseManualEntrySchema', () => {
    it('histórico opcional', () => {
        expect(reverseManualEntrySchema.parse({})).toEqual({});
        expect(reverseManualEntrySchema.parse({ description: ' Duplicado ' })).toEqual({
            description: 'Duplicado',
        });
        expect(reverseManualEntrySchema.safeParse({ description: 'x'.repeat(256) }).success).toBe(
            false,
        );
    });
});
