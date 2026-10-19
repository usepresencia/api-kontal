import { toTitleResponse } from '@/presentation/ledger/title.mapper.js';
import { titleFixture } from '@test/support/ledger-fakes.js';

describe('toTitleResponse', () => {
    it('devolve valores como texto com 2 casas, datas YYYY-MM-DD e o saldo em aberto', () => {
        const title = titleFixture({
            settledAmount: 30050,
            amount: 100000,
            seriesId: 's1',
            seriesIndex: 2,
        });
        expect(toTitleResponse(title, 'Venda de serviços')).toEqual({
            id: 't1',
            presetId: 'pr1',
            presetName: 'Venda de serviços',
            controlAccountId: 'ar',
            resultAccountId: 'rev',
            seriesId: 's1',
            seriesIndex: 2,
            type: 'INCOME',
            status: 'OPEN',
            description: 'Venda',
            amount: '1000.00',
            settledAmount: '300.50',
            remainingAmount: '699.50',
            issueDate: '2026-10-01',
            expirationDate: '2026-11-01',
            feesPercentageMonthly: 0,
            isOpening: false,
            openingDate: null,
            createdAt: '2026-10-01T00:00:00.000Z',
        });
    });

    it('sem nome de preset devolve null', () => {
        expect(toTitleResponse(titleFixture(), null).presetName).toBeNull();
    });

    it('título de implantação traz a data de implantação', () => {
        const title = titleFixture({
            isOpening: true,
            openingDate: new Date('2026-10-05T00:00:00.000Z'),
        });
        expect(toTitleResponse(title, 'Venda')).toMatchObject({
            isOpening: true,
            openingDate: '2026-10-05',
        });
    });
});
