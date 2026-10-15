import type { ManagementDreResult } from '@/application/reports/get-management-dre.service.js';
import { type Cents, formatSignedMoney as money } from '@/domain/money.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';

/** Resposta do DRE gerencial: valores com sinal em texto e a margem em percentual com 2 casas. */
export function toManagementDreResponse({
    billingPlanId,
    start,
    end,
    report,
}: ManagementDreResult) {
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
        // Pontos-base têm a mesma escala de 2 casas dos centavos, então o formatador serve.
        contributionMarginPercent:
            report.contributionMarginBps === null ? null : money(report.contributionMarginBps),
        unclassified: report.unclassified.map(item => ({ ...item, amount: money(item.amount) })),
        ...(report.months
            ? {
                  months: report.months.map(month => ({
                      month: month.month,
                      netRevenue: money(month.netRevenue),
                      contributionMargin: money(month.contributionMargin),
                      operatingResult: money(month.operatingResult),
                      netResult: money(month.netResult),
                  })),
              }
            : {}),
    };
}
