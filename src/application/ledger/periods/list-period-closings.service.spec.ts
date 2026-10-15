import { ListPeriodClosingsService } from '@/application/ledger/periods/list-period-closings.service.js';

describe('ListPeriodClosingsService', () => {
    it('devolve a trava e os fechamentos da empresa', async () => {
        const result = { closedThrough: new Date('2026-09-30T00:00:00.000Z'), items: [] };
        const reads = { list: vi.fn().mockResolvedValue(result) };
        await expect(new ListPeriodClosingsService(reads).execute('c1')).resolves.toBe(result);
        expect(reads.list).toHaveBeenCalledWith('c1');
    });
});
