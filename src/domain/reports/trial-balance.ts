import type { Cents } from '@/domain/money.js';
import { buildAccountTree, flattenTree, type ValueOps } from '@/domain/reports/account-tree.js';
import type { TrialBalanceRow } from '@/domain/reports/ledger-rows.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';
import { type Sided, sided } from '@/domain/reports/sided.js';

export interface TrialBalanceLine {
    account: ReportAccount;
    openingBalance: Sided;
    debits: Cents;
    credits: Cents;
    closingBalance: Sided;
}

export interface TrialBalanceTotals {
    debits: Cents;
    credits: Cents;
    openingDebitBalances: Cents;
    openingCreditBalances: Cents;
    closingDebitBalances: Cents;
    closingCreditBalances: Cents;
}

export interface TrialBalanceReport {
    lines: TrialBalanceLine[];
    totals: TrialBalanceTotals;
}

interface Movement {
    opening: Cents;
    debit: Cents;
    credit: Cents;
}

const MOVEMENT_OPS: ValueOps<Movement> = {
    zero: { opening: 0, debit: 0, credit: 0 },
    add: (a, b) => ({
        opening: a.opening + b.opening,
        debit: a.debit + b.debit,
        credit: a.credit + b.credit,
    }),
};

const closingOf = (movement: Movement) => movement.opening + movement.debit - movement.credit;

function totalsOf(movements: readonly Movement[]): TrialBalanceTotals {
    const totals: TrialBalanceTotals = {
        debits: 0,
        credits: 0,
        openingDebitBalances: 0,
        openingCreditBalances: 0,
        closingDebitBalances: 0,
        closingCreditBalances: 0,
    };
    for (const movement of movements) {
        const closing = closingOf(movement);
        totals.debits += movement.debit;
        totals.credits += movement.credit;
        if (movement.opening >= 0) totals.openingDebitBalances += movement.opening;
        else totals.openingCreditBalances -= movement.opening;
        if (closing >= 0) totals.closingDebitBalances += closing;
        else totals.closingCreditBalances -= closing;
    }
    return totals;
}

/**
 * Balancete de verificação: por conta (analíticas somadas nas sintéticas, até `maxLevel`), saldo
 * anterior, débitos e créditos do período e saldo final; contas sem saldo nem movimento ficam de
 * fora; totais calculados nas contas com lançamentos.
 */
export function buildTrialBalance(
    accounts: readonly ReportAccount[],
    rows: readonly TrialBalanceRow[],
    options: { maxLevel?: number },
): TrialBalanceReport {
    const ids = new Set(accounts.map(account => account.id));
    const direct = new Map<string, Movement>();
    for (const row of rows) {
        const movement = {
            opening: row.openingDebit - row.openingCredit,
            debit: row.debit,
            credit: row.credit,
        };
        if (!ids.has(row.accountId)) continue;
        if (movement.opening === 0 && movement.debit === 0 && movement.credit === 0) continue;
        direct.set(row.accountId, movement);
    }
    const lines = flattenTree(buildAccountTree(accounts, direct, MOVEMENT_OPS))
        .filter(node => options.maxLevel === undefined || node.account.level <= options.maxLevel)
        .map(node => ({
            account: node.account,
            openingBalance: sided(node.value.opening),
            debits: node.value.debit,
            credits: node.value.credit,
            closingBalance: sided(closingOf(node.value)),
        }));
    return { lines, totals: totalsOf([...direct.values()]) };
}
