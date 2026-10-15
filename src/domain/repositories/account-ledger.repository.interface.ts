import type { Page, PageRequest } from '@/domain/pagination.js';
import type { LedgerDayRow, LedgerItemRow, LedgerTotals } from '@/domain/reports/account-ledger.js';

/** Razão de um conjunto de contas da empresa (datas inclusivas). */
export interface IAccountLedgerRepository {
    totals(
        companyId: string,
        accountIds: readonly string[],
        start: Date,
        end: Date,
    ): Promise<LedgerTotals>;
    /** Lançamentos do período por data e número, com o saldo acumulado calculado antes da paginação. */
    items(
        companyId: string,
        accountIds: readonly string[],
        start: Date,
        end: Date,
        page: PageRequest,
    ): Promise<Page<LedgerItemRow>>;
    days(
        companyId: string,
        accountIds: readonly string[],
        start: Date,
        end: Date,
    ): Promise<LedgerDayRow[]>;
}
