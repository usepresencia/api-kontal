import { pageQuerySchema } from '@/presentation/common/page-query.schema.js';

describe('pageQuerySchema', () => {
    it('aplica os padrões page=1 e pageSize=10', () => {
        expect(pageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
    });

    it('converte strings da query em números', () => {
        expect(pageQuerySchema.parse({ page: '3', pageSize: '25' })).toEqual({
            page: 3,
            pageSize: 25,
        });
    });

    it('aceita os limites de pageSize (1 e 100)', () => {
        expect(pageQuerySchema.parse({ pageSize: '1' }).pageSize).toBe(1);
        expect(pageQuerySchema.parse({ pageSize: '100' }).pageSize).toBe(100);
    });

    it.each([
        ['page zero', { page: '0' }],
        ['page negativa', { page: '-1' }],
        ['page fracionária', { page: '1.5' }],
        ['page não numérica', { page: 'abc' }],
        ['page vazia', { page: '' }],
        ['pageSize zero', { pageSize: '0' }],
        ['pageSize acima de 100', { pageSize: '101' }],
        ['pageSize não numérico', { pageSize: 'abc' }],
    ])('rejeita %s', (_label, query) => {
        expect(pageQuerySchema.safeParse(query).success).toBe(false);
    });
});
