import type {
    AccountBalance,
    MonthlyMovement,
    TrialBalanceRow,
} from '@/domain/reports/ledger-rows.js';

/** Agregações do razão de um plano da empresa (datas inclusivas). */
export interface ILedgerTotalsRepository {
    /** Débitos e créditos por conta e mês das contas de receita e despesa, entre `start` e `end`. */
    monthlyMovements(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
    ): Promise<MonthlyMovement[]>;
    /** Por conta: débitos e créditos antes de `start` e entre `start` e `end`. */
    trialBalance(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
    ): Promise<TrialBalanceRow[]>;
    /** Por conta: débitos e créditos acumulados até `date`. */
    balancesUntil(companyId: string, planId: string, date: Date): Promise<AccountBalance[]>;
}
