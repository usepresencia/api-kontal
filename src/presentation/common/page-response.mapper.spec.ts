import { toPageResponse } from '@/presentation/common/page-response.mapper.js';

describe('toPageResponse', () => {
    it('mapeia os itens e mantém os metadados da página', () => {
        const response = toPageResponse({ items: [1, 2], page: 2, pageSize: 2, total: 5 }, n => ({
            n,
        }));
        expect(response).toEqual({ items: [{ n: 1 }, { n: 2 }], page: 2, pageSize: 2, total: 5 });
    });
});
