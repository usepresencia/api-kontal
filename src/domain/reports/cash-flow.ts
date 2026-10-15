import type { PaymentMethod } from '@/domain/entities/entry.entity.js';
import { TitleType } from '@/domain/ledger/title-type.js';
import type { Cents } from '@/domain/money.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';

export type CashGroupBy = 'month' | 'day';

/** Soma de pagamentos de uma conta financeira em um período (`bucket`, vazio se sem agrupamento). */
export interface CashRow {
    accountId: string;
    bucket: string;
    type: TitleType;
    amount: Cents;
}

export interface CashPayment {
    entryId: string;
    titleId: string;
    titleDescription: string;
    type: TitleType;
    accountId: string;
    accountCode: string;
    accountName: string;
    paymentMethod: PaymentMethod;
    paidAt: Date;
    amount: Cents;
}

export interface CashAccountLine {
    account: ReportAccount;
    inflows: Cents;
    outflows: Cents;
    net: Cents;
}

export interface CashBucket {
    key: string;
    inflows: Cents;
    outflows: Cents;
    net: Cents;
}

export interface CashDay extends CashBucket {
    payments: CashPayment[];
}

export interface CashFlowReport {
    totals: { inflows: Cents; outflows: Cents; net: Cents };
    accounts: CashAccountLine[];
    buckets: CashBucket[] | null;
}

interface Flow {
    inflows: Cents;
    outflows: Cents;
}

function add(flow: Flow, row: CashRow): void {
    if (row.type === TitleType.INCOME) flow.inflows += row.amount;
    else flow.outflows += row.amount;
}

const net = (flow: Flow): Cents => flow.inflows - flow.outflows;

/**
 * Fluxo de caixa realizado: entradas (títulos a receber) e saídas (a pagar) por conta financeira
 * do plano e, se pedido, por mês ou dia; contas fora do plano são ignoradas.
 */
export function buildCashFlow(
    accounts: readonly ReportAccount[],
    rows: readonly CashRow[],
    groupBy: CashGroupBy | undefined,
): CashFlowReport {
    const ids = new Set(accounts.map(account => account.id));
    const totals: Flow = { inflows: 0, outflows: 0 };
    const byAccount = new Map<string, Flow>();
    const byBucket = new Map<string, Flow>();
    for (const row of rows) {
        if (!ids.has(row.accountId)) continue;
        add(totals, row);
        const account = byAccount.get(row.accountId) ?? { inflows: 0, outflows: 0 };
        add(account, row);
        byAccount.set(row.accountId, account);
        const bucket = byBucket.get(row.bucket) ?? { inflows: 0, outflows: 0 };
        add(bucket, row);
        byBucket.set(row.bucket, bucket);
    }
    return {
        totals: { ...totals, net: net(totals) },
        accounts: accounts
            .filter(account => byAccount.has(account.id))
            .map(account => {
                const flow = byAccount.get(account.id) as Flow;
                return { account, ...flow, net: net(flow) };
            }),
        buckets: groupBy
            ? [...byBucket.entries()]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, flow]) => ({ key, ...flow, net: net(flow) }))
            : null,
    };
}

/** Anexa a cada dia os pagamentos dele, mantendo a ordem recebida. */
export function withPayments(
    days: readonly CashBucket[],
    payments: readonly CashPayment[],
): CashDay[] {
    const byDate = new Map<string, CashPayment[]>();
    for (const payment of payments) {
        const key = payment.paidAt.toISOString().slice(0, 10);
        byDate.set(key, [...(byDate.get(key) ?? []), payment]);
    }
    return days.map(day => ({ ...day, payments: byDate.get(day.key) ?? [] }));
}
