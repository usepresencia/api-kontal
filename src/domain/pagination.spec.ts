import { pageOffset } from '@/domain/pagination.js';

describe('pageOffset', () => {
    it.each([
        [{ page: 1, pageSize: 10 }, 0],
        [{ page: 2, pageSize: 10 }, 10],
        [{ page: 3, pageSize: 25 }, 50],
    ])('%j → %i', (request, expected) => {
        expect(pageOffset(request)).toBe(expected);
    });
});
