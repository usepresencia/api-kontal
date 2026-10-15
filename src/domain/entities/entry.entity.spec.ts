import { EntryEntity, EntryKind, PaymentMethod } from '@/domain/entities/entry.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

const today = new Date('2026-10-14T00:00:00.000Z');
const issueDate = new Date('2026-10-01T00:00:00.000Z');
const paidAt = new Date('2026-10-10T00:00:00.000Z');

const payment = (overrides: Record<string, unknown> = {}) =>
    EntryEntity.payment({
        id: 'e1',
        titleId: 't1',
        billingAccountId: 'bank',
        principal: 100000,
        paidAt,
        paymentMethod: PaymentMethod.PIX,
        issueDate,
        today,
        ...overrides,
    });
const code = (value: string) => expect.objectContaining({ code: value });

describe('EntryEntity.payment', () => {
    it('pagamento simples: total igual ao principal', () => {
        const entry = payment({ description: ' Pix recebido ' });
        expect(entry).toMatchObject({
            id: 'e1',
            titleId: 't1',
            kind: EntryKind.PAYMENT,
            billingAccountId: 'bank',
            principalAmount: 100000,
            interestAmount: 0,
            fineAmount: 0,
            discountAmount: 0,
            totalAmount: 100000,
            paidAt,
            paymentMethod: 'PIX',
            description: 'Pix recebido',
        });
    });

    it('calcula o total: principal + juros + multa − desconto', () => {
        const entry = payment({ interest: 5000, fine: 2000, discount: 3000 });
        expect(entry.totalAmount).toBe(104000);
        expect(entry.amounts).toEqual({
            principal: 100000,
            interest: 5000,
            fine: 2000,
            discount: 3000,
            total: 104000,
        });
    });

    it('aceita pagar na própria data de emissão e hoje', () => {
        expect(() => payment({ paidAt: issueDate })).not.toThrow();
        expect(() => payment({ paidAt: today })).not.toThrow();
    });

    it.each([
        ['principal zero', { principal: 0 }],
        ['principal negativo', { principal: -1 }],
        ['principal fracionado', { principal: 10.5 }],
        ['juros negativos', { interest: -1 }],
        ['multa negativa', { fine: -1 }],
        ['desconto negativo', { discount: -1 }],
        ['desconto acima do principal', { discount: 100001 }],
        ['total acima do limite', { principal: 999_999_999_999, interest: 1 }],
    ])('rejeita %s com ENTRY_AMOUNT_INVALID', (_label, overrides) => {
        expect(() => payment(overrides)).toThrow(code('ENTRY_AMOUNT_INVALID'));
    });

    it.each([
        ['data futura', { paidAt: new Date('2026-10-15T00:00:00.000Z') }],
        ['data anterior à emissão', { paidAt: new Date('2026-09-30T00:00:00.000Z') }],
        ['data inválida', { paidAt: new Date('invalid') }],
    ])('rejeita %s com ENTRY_DATE_INVALID', (_label, overrides) => {
        expect(() => payment(overrides)).toThrow(code('ENTRY_DATE_INVALID'));
    });

    it('rejeita descrição acima de 255', () => {
        expect(() => payment({ description: 'x'.repeat(256) })).toThrow(DomainError);
    });
});

describe('EntryEntity.writeOff', () => {
    const writeOff = (overrides: Record<string, unknown> = {}) =>
        EntryEntity.writeOff({
            id: 'e2',
            titleId: 't1',
            principal: 70000,
            issueDate,
            today,
            ...overrides,
        });

    it('encerra o saldo: sem conta, sem forma de pagamento, sem encargos e com total zero', () => {
        expect(writeOff()).toMatchObject({
            kind: EntryKind.WRITE_OFF,
            billingAccountId: null,
            paymentMethod: null,
            principalAmount: 70000,
            interestAmount: 0,
            fineAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            paidAt: today,
            description: 'Baixa por perda',
        });
    });

    it('respeita data e descrição informadas', () => {
        expect(writeOff({ paidAt, description: ' Cliente sumiu ' })).toMatchObject({
            paidAt,
            description: 'Cliente sumiu',
        });
    });

    it('saldo zero ou data fora da faixa é recusado', () => {
        expect(() => writeOff({ principal: 0 })).toThrow(code('ENTRY_AMOUNT_INVALID'));
        expect(() => writeOff({ paidAt: new Date('2026-10-15T00:00:00.000Z') })).toThrow(
            code('ENTRY_DATE_INVALID'),
        );
    });
});

describe('EntryEntity.withChanges', () => {
    it('altera descrição e forma de pagamento de um pagamento e preserva o resto', () => {
        const changed = payment().withChanges({
            description: ' Novo ',
            paymentMethod: PaymentMethod.CASH,
        });
        expect(changed).toMatchObject({
            description: 'Novo',
            paymentMethod: 'CASH',
            principalAmount: 100000,
            paidAt,
            billingAccountId: 'bank',
        });
    });

    it('sem campos mantém tudo', () => {
        expect(payment({ description: 'a' }).withChanges({})).toMatchObject({
            description: 'a',
            paymentMethod: 'PIX',
        });
    });

    it('baixa por perda não tem forma de pagamento', () => {
        const writeOff = EntryEntity.writeOff({
            id: 'e2',
            titleId: 't1',
            principal: 100,
            issueDate,
            today,
        });
        expect(writeOff.withChanges({ description: 'x' }).description).toBe('x');
        expect(() => writeOff.withChanges({ paymentMethod: PaymentMethod.PIX })).toThrow(
            DomainError,
        );
    });
});

describe('EntryEntity.fromPersistence', () => {
    it('reidrata sem revalidar', () => {
        const createdAt = new Date('2026-01-01');
        const entry = EntryEntity.fromPersistence({
            id: 'e9',
            titleId: 't9',
            kind: EntryKind.PAYMENT,
            billingAccountId: 'bank',
            principalAmount: 100,
            interestAmount: 0,
            fineAmount: 0,
            discountAmount: 0,
            totalAmount: 100,
            paidAt,
            paymentMethod: PaymentMethod.DEBIT,
            description: '',
            createdAt,
        });
        expect(entry.createdAt).toBe(createdAt);
    });
});
