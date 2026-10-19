import type { DreResult } from '@/application/reports/get-dre.service.js';
import { formatSignedMoney as money } from '@/domain/money.js';
import type { AccountNode } from '@/domain/reports/account-tree.js';
import type { Cents } from '@/domain/money.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';
import { toTreeResponse } from '@/presentation/reports/tree.mapper.js';

const dreNode = (node: AccountNode<Cents>) => ({
    dreCategory: node.account.dreCategory,
    amount: money(node.value),
});

/** Resposta do DRE: valores com sinal em texto e datas `YYYY-MM-DD`. */
export function toDreResponse({ billingPlanId, start, end, report }: DreResult) {
    return {
        billingPlanId,
        start: toIsoDate(start),
        end: toIsoDate(end),
        lines: Object.fromEntries(
            (Object.entries(report.lines) as [string, Cents][]).map(([line, value]) => [
                line,
                money(value),
            ]),
        ),
        totals: {
            revenues: money(report.totals.revenues),
            expenses: money(report.totals.expenses),
            result: money(report.totals.result),
        },
        revenueTree: report.revenueTree.map(node => toTreeResponse(node, dreNode)),
        expenseTree: report.expenseTree.map(node => toTreeResponse(node, dreNode)),
        unclassified: report.unclassified.map(item => ({ ...item, amount: money(item.amount) })),
        ...(report.months
            ? {
                  months: report.months.map(month => ({
                      month: month.month,
                      revenues: money(month.revenues),
                      expenses: money(month.expenses),
                      result: money(month.result),
                  })),
              }
            : {}),
    };
}
