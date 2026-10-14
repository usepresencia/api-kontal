export interface PageRequest {
    page: number;
    pageSize: number;
}

export interface Page<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
}

/** Quantidade de registros a pular para chegar à página. */
export function pageOffset(request: PageRequest): number {
    return (request.page - 1) * request.pageSize;
}
