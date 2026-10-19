import { TitleEntity } from '@/domain/entities/title.entity.js';
import {
    toTitleCreateData,
    toTitleEntity,
    toTitleUpdateData,
} from '@/infrastructure/persistence/title.prisma.mapper.js';

const dec = (text: string) => ({ toFixed: () => text });
const day = new Date('2026-10-14T00:00:00.000Z');
const row = {
    id: 't1',
    companyId: 'c1',
    presetId: 'pr1',
    controlAccountId: 'ar',
    resultAccountId: 'rev',
    seriesId: null,
    seriesIndex: null,
    type: 'INCOME',
    status: 'OPEN',
    description: 'Venda',
    amount: dec('1000.50'),
    settledAmount: dec('0.00'),
    issueDate: day,
    expirationDate: day,
    feesPercentageMonthly: dec('0.05'),
    isOpening: false,
    openingDate: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
};

describe('title.prisma.mapper', () => {
    it('toTitleEntity converte os Decimais em centavos e juros em número', () => {
        const title = toTitleEntity(row as never);
        expect(title).toMatchObject({
            id: 't1',
            amount: 100050,
            settledAmount: 0,
            feesPercentageMonthly: 0.05,
            status: 'OPEN',
            controlAccountId: 'ar',
        });
    });

    it('toTitleCreateData grava todos os campos com Decimais exatos', () => {
        const data = toTitleCreateData(toTitleEntity(row as never));
        expect(data).toMatchObject({
            id: 't1',
            companyId: 'c1',
            presetId: 'pr1',
            controlAccountId: 'ar',
            resultAccountId: 'rev',
            seriesId: null,
            seriesIndex: null,
            type: 'INCOME',
            status: 'OPEN',
            description: 'Venda',
        });
        expect(data).toMatchObject({ isOpening: false, openingDate: null });
        expect(String(data.amount)).toBe('1000.5');
        expect(String(data.feesPercentageMonthly)).toBe('0.05');
    });

    it('ida e volta de título de implantação', () => {
        const openingDate = new Date('2026-10-05T00:00:00.000Z');
        const title = toTitleEntity({ ...row, isOpening: true, openingDate } as never);
        expect(title).toMatchObject({ isOpening: true });
        expect(title.openingDate).toEqual(openingDate);
        expect(toTitleCreateData(title)).toMatchObject({ isOpening: true, openingDate });
    });

    it('toTitleUpdateData grava só o que muda depois da criação', () => {
        const title = TitleEntity.fromPersistence({
            id: 't1',
            companyId: 'c1',
            presetId: 'pr1',
            controlAccountId: 'ar',
            resultAccountId: 'rev',
            seriesId: null,
            seriesIndex: null,
            type: 'INCOME',
            status: 'SETTLED',
            description: 'x',
            amount: 500,
            settledAmount: 500,
            issueDate: day,
            expirationDate: day,
            feesPercentageMonthly: 0,
            isOpening: false,
            openingDate: null,
            createdAt: day,
        });
        const data = toTitleUpdateData(title);
        expect(Object.keys(data).sort()).toEqual([
            'description',
            'expirationDate',
            'feesPercentageMonthly',
            'settledAmount',
            'status',
        ]);
        expect(data.status).toBe('SETTLED');
        expect(data.settledAmount.toFixed(2)).toBe('5.00');
    });
});
