import { EntryEntity, EntryKind, PaymentMethod } from '@/domain/entities/entry.entity.js';
import {
    toEntryCreateData,
    toEntryEntity,
    toEntryUpdateData,
} from '@/infrastructure/persistence/entry.prisma.mapper.js';

const dec = (text: string) => ({ toFixed: () => text });
const day = new Date('2026-10-10T00:00:00.000Z');
const row = {
    id: 'e1',
    titleId: 't1',
    kind: 'PAYMENT',
    billingAccountId: 'bank',
    principalAmount: dec('1000.00'),
    interestAmount: dec('50.00'),
    fineAmount: dec('20.00'),
    discountAmount: dec('30.00'),
    totalAmount: dec('1040.00'),
    paidAt: day,
    paymentMethod: 'PIX',
    description: 'Pix',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
};

describe('entry.prisma.mapper', () => {
    it('toEntryEntity converte os Decimais em centavos', () => {
        expect(toEntryEntity(row as never)).toMatchObject({
            id: 'e1',
            kind: 'PAYMENT',
            principalAmount: 100000,
            interestAmount: 5000,
            fineAmount: 2000,
            discountAmount: 3000,
            totalAmount: 104000,
            paymentMethod: 'PIX',
        });
    });

    it('toEntryCreateData grava os valores como Decimais exatos', () => {
        const data = toEntryCreateData(toEntryEntity(row as never));
        expect(data).toMatchObject({
            id: 'e1',
            titleId: 't1',
            kind: 'PAYMENT',
            billingAccountId: 'bank',
            paymentMethod: 'PIX',
        });
        expect(data.totalAmount.toFixed(2)).toBe('1040.00');
        expect(data.discountAmount.toFixed(2)).toBe('30.00');
    });

    it('baixa por perda grava conta e forma de pagamento nulas', () => {
        const writeOff = EntryEntity.writeOff({
            id: 'e2',
            titleId: 't1',
            principal: 700,
            issueDate: day,
            today: day,
        });
        const data = toEntryCreateData(writeOff);
        expect(data).toMatchObject({
            kind: EntryKind.WRITE_OFF,
            billingAccountId: null,
            paymentMethod: null,
        });
    });

    it('toEntryUpdateData grava só descrição e forma de pagamento', () => {
        const entry = EntryEntity.fromPersistence({
            id: 'e1',
            titleId: 't1',
            kind: EntryKind.PAYMENT,
            billingAccountId: 'bank',
            principalAmount: 1,
            interestAmount: 0,
            fineAmount: 0,
            discountAmount: 0,
            totalAmount: 1,
            paidAt: day,
            paymentMethod: PaymentMethod.CASH,
            description: 'd',
            createdAt: day,
        });
        expect(toEntryUpdateData(entry)).toEqual({ description: 'd', paymentMethod: 'CASH' });
    });
});
