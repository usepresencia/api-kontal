import type { TrialBalanceResult } from '@/application/reports/get-trial-balance.service.js';
import { formatMoney } from '@/domain/money.js';
import type { Sided } from '@/domain/reports/sided.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';

/** Saldo com lado em texto: `{ amount: "10.00", side: "D" }`. */
export function toSidedResponse(balance: Sided) {
    return { amount: formatMoney(balance.amount), side: balance.side };
}

/** Resposta do balancete: linhas na ordem do plano e totais de prova. */
export function toTrialBalanceResponse({ billingPlanId, start, end, report }: TrialBalanceResult) {
    const { totals } = report;
    return {
        billingPlanId,
        start: toIsoDate(start),
        end: toIsoDate(end),
        lines: report.lines.map(line => ({
            accountId: line.account.id,
            code: line.account.code,
            name: line.account.name,
            level: line.account.level,
            nature: line.account.nature,
            accountType: line.account.accountType,
            openingBalance: toSidedResponse(line.openingBalance),
            debits: formatMoney(line.debits),
            credits: formatMoney(line.credits),
            closingBalance: toSidedResponse(line.closingBalance),
        })),
        totals: {
            debits: formatMoney(totals.debits),
            credits: formatMoney(totals.credits),
            openingDebitBalances: formatMoney(totals.openingDebitBalances),
            openingCreditBalances: formatMoney(totals.openingCreditBalances),
            closingDebitBalances: formatMoney(totals.closingDebitBalances),
            closingCreditBalances: formatMoney(totals.closingCreditBalances),
        },
    };
}
