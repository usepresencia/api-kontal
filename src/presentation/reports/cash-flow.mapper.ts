import type { CashFlowResult } from '@/application/reports/get-cash-flow.service.js';
import { formatSignedMoney as money } from '@/domain/money.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';

/** Resposta do fluxo de caixa: totais e contas, mais `months` ou `days` conforme o agrupamento. */
export function toCashFlowResponse({
    billingPlanId,
    start,
    end,
    groupBy,
    report,
    days,
}: CashFlowResult) {
    const flow = (item: { inflows: number; outflows: number; net: number }) => ({
        inflows: money(item.inflows),
        outflows: money(item.outflows),
        net: money(item.net),
    });
    return {
        billingPlanId,
        start: toIsoDate(start),
        end: toIsoDate(end),
        totals: flow(report.totals),
        accounts: report.accounts.map(line => ({
            accountId: line.account.id,
            code: line.account.code,
            name: line.account.name,
            ...flow(line),
        })),
        ...(groupBy === 'month'
            ? {
                  months: (report.buckets ?? []).map(bucket => ({
                      month: bucket.key,
                      ...flow(bucket),
                  })),
              }
            : {}),
        ...(groupBy === 'day'
            ? {
                  days: (days ?? []).map(day => ({
                      date: day.key,
                      ...flow(day),
                      payments: day.payments.map(payment => ({
                          entryId: payment.entryId,
                          titleId: payment.titleId,
                          titleDescription: payment.titleDescription,
                          type: payment.type,
                          accountCode: payment.accountCode,
                          accountName: payment.accountName,
                          paymentMethod: payment.paymentMethod,
                          amount: money(payment.amount),
                      })),
                  })),
              }
            : {}),
    };
}
