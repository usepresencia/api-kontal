import type { BalanceSheetResult } from '@/application/reports/get-balance-sheet.service.js';
import { type Cents, formatSignedMoney as money } from '@/domain/money.js';
import type { AccountNode } from '@/domain/reports/account-tree.js';
import type { BalanceGroup } from '@/domain/reports/balance-sheet.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';
import { toTreeResponse } from '@/presentation/reports/tree.mapper.js';

const balanceNode = (node: AccountNode<Cents>) => ({
    balanceCategory: node.account.balanceCategory,
    amount: money(node.value),
});

const toGroup = (group: BalanceGroup) => ({
    tree: group.tree.map(node => toTreeResponse(node, balanceNode)),
    total: money(group.total),
});

/** Resposta do balanço: grupos com árvore e total, PL e prova, valores com sinal em texto. */
export function toBalanceSheetResponse({ billingPlanId, date, sheet }: BalanceSheetResult) {
    return {
        billingPlanId,
        date: toIsoDate(date),
        assets: {
            current: toGroup(sheet.assets.current),
            nonCurrent: toGroup(sheet.assets.nonCurrent),
            total: money(sheet.assets.total),
        },
        liabilities: {
            current: toGroup(sheet.liabilities.current),
            nonCurrent: toGroup(sheet.liabilities.nonCurrent),
            total: money(sheet.liabilities.total),
        },
        equity: {
            accounts: toGroup(sheet.equity.accounts),
            accumulatedResult: money(sheet.equity.accumulatedResult),
            total: money(sheet.equity.total),
        },
        liabilitiesAndEquity: money(sheet.liabilitiesAndEquity),
        unclassified: sheet.unclassified.map(item => ({ ...item, amount: money(item.amount) })),
    };
}
