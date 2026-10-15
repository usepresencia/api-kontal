import type { CashGroupBy, CashPayment, CashRow } from '@/domain/reports/cash-flow.js';

/** Pagamentos realizados de um plano da empresa (datas inclusivas). */
export interface ICashFlowRepository {
    /** Soma de `totalAmount` por conta financeira, período (mês, dia ou nenhum) e tipo do título. */
    totals(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
        groupBy: CashGroupBy | undefined,
    ): Promise<CashRow[]>;
    /** Pagamentos do período por data, conta (ordem do plano) e criação. */
    payments(companyId: string, planId: string, start: Date, end: Date): Promise<CashPayment[]>;
}
