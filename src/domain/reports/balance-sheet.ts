import { AccountNature } from '@/domain/billing/account-nature.js';
import { BalanceCategory, balanceCategoryRules } from '@/domain/billing/balance-category.js';
import type { Cents } from '@/domain/money.js';
import { type AccountNode, buildAccountTree, CENTS_OPS } from '@/domain/reports/account-tree.js';
import type { UnclassifiedAccount } from '@/domain/reports/dre.js';
import type { AccountBalance } from '@/domain/reports/ledger-rows.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';

export interface BalanceGroup {
    tree: AccountNode<Cents>[];
    total: Cents;
}

export interface BalanceSheet {
    assets: { current: BalanceGroup; nonCurrent: BalanceGroup; total: Cents };
    liabilities: { current: BalanceGroup; nonCurrent: BalanceGroup; total: Cents };
    equity: { accounts: BalanceGroup; accumulatedResult: Cents; total: Cents };
    liabilitiesAndEquity: Cents;
    unclassified: UnclassifiedAccount[];
}

const DEBIT_NATURES: readonly AccountNature[] = [AccountNature.ASSET, AccountNature.EXPENSE];

/** Saldo natural: ativo e despesa = débito − crédito; os demais = crédito − débito. */
function naturalBalance(account: ReportAccount, balance: AccountBalance): Cents {
    return DEBIT_NATURES.includes(account.nature)
        ? balance.debit - balance.credit
        : balance.credit - balance.debit;
}

function group(
    accounts: readonly ReportAccount[],
    direct: ReadonlyMap<string, Cents>,
    category: BalanceCategory,
): BalanceGroup {
    const members = accounts.filter(
        account =>
            balanceCategoryRules.effective(account.nature, account.balanceCategory) === category,
    );
    let total = 0;
    for (const account of members) total += direct.get(account.id) ?? 0;
    return { tree: buildAccountTree(members, direct, CENTS_OPS), total };
}

/**
 * Balanço patrimonial a partir dos débitos e créditos acumulados até a data: ativo e passivo
 * por grupo (circulante e não circulante), PL com o resultado acumulado ainda não apurado e
 * as contas patrimoniais sem categoria.
 */
export function buildBalanceSheet(
    accounts: readonly ReportAccount[],
    balances: readonly AccountBalance[],
): BalanceSheet {
    const byId = new Map(accounts.map(account => [account.id, account]));
    const direct = new Map<string, Cents>();
    let accumulatedResult = 0;
    for (const balance of balances) {
        const account = byId.get(balance.accountId);
        if (!account) continue;
        const amount = naturalBalance(account, balance);
        if (account.nature === AccountNature.REVENUE) accumulatedResult += amount;
        else if (account.nature === AccountNature.EXPENSE) accumulatedResult -= amount;
        else direct.set(account.id, amount);
    }

    const current = group(accounts, direct, BalanceCategory.CURRENT_ASSET);
    const nonCurrent = group(accounts, direct, BalanceCategory.NON_CURRENT_ASSET);
    const currentLiabilities = group(accounts, direct, BalanceCategory.CURRENT_LIABILITY);
    const nonCurrentLiabilities = group(accounts, direct, BalanceCategory.NON_CURRENT_LIABILITY);
    const equityAccounts = group(accounts, direct, BalanceCategory.EQUITY);
    const liabilitiesTotal = currentLiabilities.total + nonCurrentLiabilities.total;
    const equityTotal = equityAccounts.total + accumulatedResult;

    const unclassified = accounts
        .filter(account => account.nature !== AccountNature.EQUITY)
        .filter(account => account.balanceCategory === null && direct.has(account.id))
        .map(account => ({
            accountId: account.id,
            code: account.code,
            name: account.name,
            nature: account.nature,
            amount: direct.get(account.id) as Cents,
        }));

    return {
        assets: { current, nonCurrent, total: current.total + nonCurrent.total },
        liabilities: {
            current: currentLiabilities,
            nonCurrent: nonCurrentLiabilities,
            total: liabilitiesTotal,
        },
        equity: { accounts: equityAccounts, accumulatedResult, total: equityTotal },
        liabilitiesAndEquity: liabilitiesTotal + equityTotal,
        unclassified,
    };
}
