import { listJournalEntriesQuerySchema } from '@/presentation/ledger/journal.schemas.js';

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
