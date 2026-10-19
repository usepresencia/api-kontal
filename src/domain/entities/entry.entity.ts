import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { PaymentAmounts } from '@/domain/ledger/posting.policy.js';
import { type Cents, MAX_CENTS } from '@/domain/money.js';
import { optionalText } from '@/domain/required-text.js';

export const EntryKind = {
    PAYMENT: 'PAYMENT',
    WRITE_OFF: 'WRITE_OFF',
} as const;

export type EntryKind = (typeof EntryKind)[keyof typeof EntryKind];

export const PaymentMethod = {
    CASH: 'CASH',
    DEBIT: 'DEBIT',
    CREDIT: 'CREDIT',
    PIX: 'PIX',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export interface EntryRow {
    id: string;
    titleId: string;
    kind: EntryKind;
    billingAccountId: string | null;
    principalAmount: Cents;
    interestAmount: Cents;
    fineAmount: Cents;
    discountAmount: Cents;
    totalAmount: Cents;
    paidAt: Date;
    paymentMethod: PaymentMethod | null;
    description: string;
    createdAt: Date;
}

function invalidAmount(message: string): never {
    throw new DomainError(ErrorCode.ENTRY_AMOUNT_INVALID, message);
}

function assertCents(value: Cents, label: string): void {
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
        invalidAmount(`${label} inválido`);
    }
}

function assertPaymentDate(paidAt: Date, issueDate: Date, today: Date): void {
    const time = paidAt.getTime();
    if (Number.isNaN(time) || time > today.getTime() || time < issueDate.getTime()) {
        throw new DomainError(
            ErrorCode.ENTRY_DATE_INVALID,
            'A data da baixa não pode ser futura nem anterior à emissão do título',
        );
    }
}

/** Baixa de um título: pagamento (com encargos) ou perda do saldo. */
export class EntryEntity {
    private constructor(private readonly row: EntryRow) {}

    get id(): string {
        return this.row.id;
    }
    get titleId(): string {
        return this.row.titleId;
    }
    get kind(): EntryKind {
        return this.row.kind;
    }
    get billingAccountId(): string | null {
        return this.row.billingAccountId;
    }
    get principalAmount(): Cents {
        return this.row.principalAmount;
    }
    get interestAmount(): Cents {
        return this.row.interestAmount;
    }
    get fineAmount(): Cents {
        return this.row.fineAmount;
    }
    get discountAmount(): Cents {
        return this.row.discountAmount;
    }
    get totalAmount(): Cents {
        return this.row.totalAmount;
    }
    get paidAt(): Date {
        return this.row.paidAt;
    }
    get paymentMethod(): PaymentMethod | null {
        return this.row.paymentMethod;
    }
    get description(): string {
        return this.row.description;
    }
    get createdAt(): Date {
        return this.row.createdAt;
    }

    /** Valores da baixa no formato usado pela política de postagem. */
    get amounts(): PaymentAmounts {
        return {
            principal: this.row.principalAmount,
            interest: this.row.interestAmount,
            fine: this.row.fineAmount,
            discount: this.row.discountAmount,
            total: this.row.totalAmount,
        };
    }

    /**
     * Cria um pagamento: total = principal + juros + multa − desconto.
     * @throws DomainError ENTRY_AMOUNT_INVALID, ENTRY_DATE_INVALID
     */
    static payment(params: {
        id: string;
        titleId: string;
        billingAccountId: string;
        principal: Cents;
        interest?: Cents;
        fine?: Cents;
        discount?: Cents;
        paidAt: Date;
        paymentMethod: PaymentMethod;
        description?: string;
        issueDate: Date;
        today: Date;
        createdAt?: Date;
    }): EntryEntity {
        const interest = params.interest ?? 0;
        const fine = params.fine ?? 0;
        const discount = params.discount ?? 0;
        assertCents(params.principal, 'Valor principal');
        assertCents(interest, 'Juros');
        assertCents(fine, 'Multa');
        assertCents(discount, 'Desconto');
        if (params.principal === 0) invalidAmount('O valor principal deve ser maior que zero');
        if (discount > params.principal)
            invalidAmount('O desconto não pode exceder o valor principal');
        const total = params.principal + interest + fine - discount;
        if (total <= 0 || total > MAX_CENTS) invalidAmount('Valor total da baixa inválido');
        assertPaymentDate(params.paidAt, params.issueDate, params.today);
        return new EntryEntity({
            id: params.id,
            titleId: params.titleId,
            kind: EntryKind.PAYMENT,
            billingAccountId: params.billingAccountId,
            principalAmount: params.principal,
            interestAmount: interest,
            fineAmount: fine,
            discountAmount: discount,
            totalAmount: total,
            paidAt: params.paidAt,
            paymentMethod: params.paymentMethod,
            description: optionalText(params.description, 'Descrição'),
            createdAt: params.createdAt ?? new Date(),
        });
    }

    /**
     * Cria a baixa por perda do saldo em aberto (sem conta, sem forma de pagamento, total zero).
     * @throws DomainError ENTRY_AMOUNT_INVALID, ENTRY_DATE_INVALID
     */
    static writeOff(params: {
        id: string;
        titleId: string;
        principal: Cents;
        paidAt?: Date;
        description?: string;
        issueDate: Date;
        today: Date;
        createdAt?: Date;
    }): EntryEntity {
        assertCents(params.principal, 'Saldo');
        if (params.principal === 0) invalidAmount('Não há saldo em aberto para baixar');
        const paidAt = params.paidAt ?? params.today;
        assertPaymentDate(paidAt, params.issueDate, params.today);
        return new EntryEntity({
            id: params.id,
            titleId: params.titleId,
            kind: EntryKind.WRITE_OFF,
            billingAccountId: null,
            principalAmount: params.principal,
            interestAmount: 0,
            fineAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            paidAt,
            paymentMethod: null,
            description: optionalText(params.description, 'Descrição') || 'Baixa por perda',
            createdAt: params.createdAt ?? new Date(),
        });
    }

    /** Altera só descrição e forma de pagamento (esta, apenas em pagamentos). */
    withChanges(changes: { description?: string; paymentMethod?: PaymentMethod }): EntryEntity {
        if (changes.paymentMethod !== undefined && this.row.kind === EntryKind.WRITE_OFF) {
            throw new DomainError(
                ErrorCode.VALIDATION_ERROR,
                'Baixa por perda não tem forma de pagamento',
            );
        }
        return new EntryEntity({
            ...this.row,
            description:
                changes.description === undefined
                    ? this.row.description
                    : optionalText(changes.description, 'Descrição'),
            paymentMethod: changes.paymentMethod ?? this.row.paymentMethod,
        });
    }

    static fromPersistence(row: EntryRow): EntryEntity {
        return new EntryEntity(row);
    }
}
