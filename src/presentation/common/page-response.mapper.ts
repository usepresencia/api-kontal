import type { Page } from '@/domain/pagination.js';

/** Resposta paginada da API: itens mapeados mais os metadados da página. */
export function toPageResponse<T, R>(page: Page<T>, mapItem: (item: T) => R) {
    return {
        items: page.items.map(mapItem),
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
    };
}
