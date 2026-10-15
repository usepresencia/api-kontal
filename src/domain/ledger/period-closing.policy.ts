import { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountRef } from '@/domain/billing/account-ref.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

function invalid(message: string): never {
    throw new DomainError(ErrorCode.PERIOD_CLOSING_INVALID, message);
}

/** Último dia do mês `YYYY-MM`. */
export function monthEnd(month: string): Date {
    const [year, number] = month.split('-').map(Number);
    return new Date(Date.UTC(year, number, 0));
}

/** Mês `YYYY-MM` de uma data. */
export function monthOf(date: Date): string {
    return date.toISOString().slice(0, 7);
}

export function isDecember(month: string): boolean {
    return month.endsWith('-12');
}

function nextMonth(month: string): string {
    const [year, number] = month.split('-').map(Number);
    return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
}

/**
 * Valida o mês a fechar e devolve o último dia dele: já encerrado e, depois do primeiro
 * fechamento (o mês do lançamento mais antigo), exatamente o mês seguinte ao último fechado.
 * @throws DomainError PERIOD_CLOSING_INVALID
 */
export function assertClosableMonth(params: {
    month: string;
    today: Date;
    closedThrough: Date | null;
    earliestLedgerDate: Date | null;
}): Date {
    const end = monthEnd(params.month);
    if (end.getTime() >= params.today.getTime()) invalid('O mês ainda não terminou');
    let expected: string | null = null;
    if (params.closedThrough) expected = nextMonth(monthOf(params.closedThrough));
    else if (params.earliestLedgerDate) expected = monthOf(params.earliestLedgerDate);
    if (expected !== null && params.month !== expected) {
        invalid(`O próximo mês a fechar é ${expected}`);
    }
    return end;
}

/**
 * Dezembro exige a conta de lucros acumulados; os demais meses não a aceitam.
 * @throws DomainError RETAINED_EARNINGS_ACCOUNT_INVALID, PERIOD_CLOSING_INVALID
 */
export function assertRetainedInput(month: string, retainedAccountId: string | undefined): void {
    if (isDecember(month) && retainedAccountId === undefined) {
        throw new DomainError(
            ErrorCode.RETAINED_EARNINGS_ACCOUNT_INVALID,
            'O fechamento de dezembro exige a conta de lucros acumulados',
        );
    }
    if (!isDecember(month) && retainedAccountId !== undefined) {
        invalid('A conta de lucros acumulados só vale no fechamento de dezembro');
    }
}

/**
 * Valida a conta de lucros acumulados: patrimônio líquido, analítica, ativa e do plano.
 * @throws DomainError RETAINED_EARNINGS_ACCOUNT_INVALID
 */
export function assertRetainedAccount(planId: string, ref: AccountRef | undefined): void {
    const valid =
        ref !== undefined &&
        ref.billingPlanId === planId &&
        ref.accountType === AccountType.ANALYTIC &&
        ref.isActive &&
        ref.nature === AccountNature.EQUITY;
    if (!valid) {
        throw new DomainError(
            ErrorCode.RETAINED_EARNINGS_ACCOUNT_INVALID,
            'A conta de lucros acumulados deve ser analítica, ativa, do plano e de patrimônio líquido',
        );
    }
}
