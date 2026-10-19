import { readCompanyId } from '@/infrastructure/auth/tenant-id.reader.js';

const read = (headers: Record<string, unknown>, query: Record<string, unknown> = {}) =>
    readCompanyId({ headers, query } as never);

describe('readCompanyId', () => {
    it('lê o header X-Tenant-Id', () => {
        expect(read({ 'x-tenant-id': 'c1' })).toBe('c1');
    });

    it('apara espaços do valor', () => {
        expect(read({ 'x-tenant-id': '  c1  ' })).toBe('c1');
    });

    it('lê o query param tenantId quando não há header', () => {
        expect(read({}, { tenantId: 'c2' })).toBe('c2');
    });

    it('o header tem precedência sobre o query param', () => {
        expect(read({ 'x-tenant-id': 'c1' }, { tenantId: 'c2' })).toBe('c1');
    });

    it.each([
        ['ausente', {}, {}],
        ['header vazio', { 'x-tenant-id': '' }, {}],
        ['header só com espaços', { 'x-tenant-id': '   ' }, {}],
        ['query como array', {}, { tenantId: ['a', 'b'] }],
        ['query como objeto', {}, { tenantId: { a: 1 } }],
    ])('undefined quando %s', (_label, headers, query) => {
        expect(read(headers, query)).toBeUndefined();
    });
});
