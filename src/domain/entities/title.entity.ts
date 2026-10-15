import type { Opening } from '@/domain/ledger/title-opening.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { TitleType } from '@/domain/ledger/title-type.js';
import { type Cents, MAX_CENTS } from '@/domain/money.js';
import { requiredText } from '@/domain/required-text.js';

export const TitleStatus = {
    OPEN: 'OPEN',
    SETTLED: 'SETTLED',
    WRITTEN_OFF: 'WRITTEN_OFF',
} as const;

export type TitleStatus = (typeof TitleStatus)[keyof typeof TitleStatus];

export interface TitleRow {
    id: string;
    companyId: string;
    presetId: string;
    controlAccountId: string;
    resultAccountId: string;
    seriesId: string | null;
    seriesIndex: number | null;
    type: TitleType;
    status: TitleStatus;
    description: string;
    amount: Cents;
    settledAmount: Cents;
    issueDate: Date;
    expirationDate: Date;
    feesPercentageMonthly: number;
    isOpening: boolean;
    openingDate: Date | null;
    createdAt: Date;
}

function validAmount(amount: Cents): Cents {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_CENTS) {
        throw new DomainError(
            ErrorCode.VALIDATION_ERROR,
            'Valor do título deve ser maior que zero',
        );
    }
    return amount;
}

function validFees(fees: number): number {
    if (!Number.isFinite(fees) || fees < 0 || fees > 1) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Juros mensais devem estar entre 0 e 1');
    }
    return Math.round(fees * 100) / 100;
}

function validDate(date: Date, label: string): Date {
    if (Number.isNaN(date.getTime())) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, `${label} inválida`);
    }
    return date;
}

/** Título a pagar ou a receber, com as contas contábeis gravadas na criação. */
export class TitleEntity {
    private constructor(private readonly row: TitleRow) {}

    get id(): string {
        return this.row.id;
    }
    get companyId(): string {
        return this.row.companyId;
    }
    get presetId(): string {
        return this.row.presetId;
    }
    get controlAccountId(): string {
        return this.row.controlAccountId;
    }
    get resultAccountId(): string {
        return this.row.resultAccountId;
    }
    get seriesId(): string | null {
        return this.row.seriesId;
    }
    get seriesIndex(): number | null {
        return this.row.seriesIndex;
    }
    get type(): TitleType {
        return this.row.type;
    }
    get status(): TitleStatus {
        return this.row.status;
    }
    get description(): string {
        return this.row.description;
    }
    get amount(): Cents {
        return this.row.amount;
    }
    get settledAmount(): Cents {
        return this.row.settledAmount;
    }
    get issueDate(): Date {
        return this.row.issueDate;
    }
    get expirationDate(): Date {
        return this.row.expirationDate;
    }
    get feesPercentageMonthly(): number {
        return this.row.feesPercentageMonthly;
    }
    get isOpening(): boolean {
        return this.row.isOpening;
    }
    get openingDate(): Date | null {
        return this.row.openingDate;
    }
    /** Primeira data em que uma baixa é aceita: a implantação, quando houver, ou a emissão. */
    get paymentFloorDate(): Date {
        return this.row.openingDate ?? this.row.issueDate;
    }
    get createdAt(): Date {
        return this.row.createdAt;
    }

    /** Saldo em aberto do título. */
    get remainingAmount(): Cents {
        return this.row.amount - this.row.settledAmount;
    }

    static create(params: {
        id: string;
        companyId: string;
        presetId: string;
        accounts: { controlAccountId: string; resultAccountId: string };
        type: TitleType;
        description: string;
        amount: Cents;
        today: Date;
        issueDate?: Date;
        expirationDate: Date;
        feesPercentageMonthly?: number;
        opening?: Opening;
        seriesId?: string;
        seriesIndex?: number;
        createdAt?: Date;
    }): TitleEntity {
        return new TitleEntity({
            id: params.id,
            companyId: params.companyId,
            presetId: params.presetId,
            controlAccountId: params.accounts.controlAccountId,
            resultAccountId: params.accounts.resultAccountId,
            seriesId: params.seriesId ?? null,
            seriesIndex: params.seriesIndex ?? null,
            type: params.type,
            status: TitleStatus.OPEN,
            description: requiredText(params.description, 'Descrição do título'),
            amount: validAmount(params.amount),
            settledAmount: params.opening?.settledAmount ?? 0,
            issueDate: validDate(
                params.issueDate ?? params.opening?.openingDate ?? params.today,
                'Data de emissão',
            ),
            expirationDate: validDate(params.expirationDate, 'Data de vencimento'),
            feesPercentageMonthly: validFees(params.feesPercentageMonthly ?? 0),
            isOpening: params.opening !== undefined,
            openingDate: params.opening?.openingDate ?? null,
            createdAt: params.createdAt ?? new Date(),
        });
    }

    /**
     * Abate o principal pago do saldo; quita o título quando o saldo zera.
     * @throws DomainError TITLE_NOT_OPEN, ENTRY_EXCEEDS_BALANCE
     */
    applyPayment(principal: Cents): TitleEntity {
        this.assertOpen();
        if (principal > this.remainingAmount) {
            throw new DomainError(
                ErrorCode.ENTRY_EXCEEDS_BALANCE,
                `O pagamento excede o saldo do título (restante: ${this.remainingAmount} centavos)`,
            );
        }
        const settledAmount = this.row.settledAmount + principal;
        return this.with({
            settledAmount,
            status: settledAmount === this.row.amount ? TitleStatus.SETTLED : TitleStatus.OPEN,
        });
    }

    /**
     * Encerra o saldo em aberto como perda.
     * @throws DomainError TITLE_NOT_OPEN
     */
    applyWriteOff(): TitleEntity {
        this.assertOpen();
        return this.with({ settledAmount: this.row.amount, status: TitleStatus.WRITTEN_OFF });
    }

    /** Desfaz o abatimento de uma baixa excluída e reabre o título. */
    revertSettlement(principal: Cents): TitleEntity {
        if (principal > this.row.settledAmount) {
            throw new DomainError(
                ErrorCode.INTERNAL_ERROR,
                'Estorno maior que o valor já abatido do título',
            );
        }
        return this.with({
            settledAmount: this.row.settledAmount - principal,
            status: TitleStatus.OPEN,
        });
    }

    /** Altera só descrição, vencimento e juros mensais. */
    withEdits(changes: {
        description?: string;
        expirationDate?: Date;
        feesPercentageMonthly?: number;
    }): TitleEntity {
        return this.with({
            description:
                changes.description === undefined
                    ? this.row.description
                    : requiredText(changes.description, 'Descrição do título'),
            expirationDate:
                changes.expirationDate === undefined
                    ? this.row.expirationDate
                    : validDate(changes.expirationDate, 'Data de vencimento'),
            feesPercentageMonthly:
                changes.feesPercentageMonthly === undefined
                    ? this.row.feesPercentageMonthly
                    : validFees(changes.feesPercentageMonthly),
        });
    }

    static fromPersistence(row: TitleRow): TitleEntity {
        return new TitleEntity(row);
    }

    private assertOpen(): void {
        if (this.row.status !== TitleStatus.OPEN) {
            throw new DomainError(ErrorCode.TITLE_NOT_OPEN, 'O título não está em aberto');
        }
    }

    private with(changes: Partial<TitleRow>): TitleEntity {
        return new TitleEntity({ ...this.row, ...changes });
    }
}

/**
 * Garante que a requisição não tenta alterar campos com efeito contábil.
 * @throws DomainError TITLE_FIELD_LOCKED
 */
export function assertLockedFieldsUnchanged(
    title: TitleEntity,
    input: { type?: TitleType; amount?: Cents; presetId?: string; issueDate?: Date },
): void {
    const changed =
        (input.type !== undefined && input.type !== title.type) ||
        (input.amount !== undefined && input.amount !== title.amount) ||
        (input.presetId !== undefined && input.presetId !== title.presetId) ||
        (input.issueDate !== undefined && input.issueDate.getTime() !== title.issueDate.getTime());
    if (changed) {
        throw new DomainError(
            ErrorCode.TITLE_FIELD_LOCKED,
            'Tipo, valor, preset e emissão do título não podem ser alterados; exclua e recrie o título',
        );
    }
}
