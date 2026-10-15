import type { Cents } from '@/domain/money.js';

/** Soma de débitos e créditos de uma conta em um mês (`YYYY-MM`). */
export interface MonthlyMovement {
    accountId: string;
    month: string;
    debit: Cents;
    credit: Cents;
}

/** Saldo anterior (antes do período) e movimento do período de uma conta. */
export interface TrialBalanceRow {
    accountId: string;
    openingDebit: Cents;
    openingCredit: Cents;
    debit: Cents;
    credit: Cents;
}

/** Débitos e créditos acumulados de uma conta até uma data. */
export interface AccountBalance {
    accountId: string;
    debit: Cents;
    credit: Cents;
}
