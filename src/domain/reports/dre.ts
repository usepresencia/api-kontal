import { AccountNature } from '@/domain/billing/account-nature.js';
import { DreCategory, dreCategoryRules } from '@/domain/billing/dre-category.js';
import type { Cents } from '@/domain/money.js';
import { type AccountNode, buildAccountTree, CENTS_OPS } from '@/domain/reports/account-tree.js';
import type { MonthlyMovement } from '@/domain/reports/ledger-rows.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';

export interface DreLines {
    grossRevenue: Cents;
    revenueDeductions: Cents;
    netRevenue: Cents;
    costOfSales: Cents;
    grossProfit: Cents;
    operatingExpenses: Cents;
    otherOperatingResult: Cents;
    operatingResult: Cents;
    financialRevenue: Cents;
    financialExpenses: Cents;
    financialResult: Cents;
    resultBeforeTaxes: Cents;
    incomeTaxes: Cents;
    netResult: Cents;
}

export interface UnclassifiedAccount {
    accountId: string;
    code: string;
    name: string;
    nature: AccountNature;
    amount: Cents;
}

export interface DreMonth {
    month: string;
    revenues: Cents;
    expenses: Cents;
    result: Cents;
}

export interface DreReport {
    lines: DreLines;
    totals: { revenues: Cents; expenses: Cents; result: Cents };
    revenueTree: AccountNode<Cents>[];
    expenseTree: AccountNode<Cents>[];
    unclassified: UnclassifiedAccount[];
    months: DreMonth[] | null;
}

export const isRevenue = (account: ReportAccount) => account.nature === AccountNature.REVENUE;
export const isResult = (account: ReportAccount) =>
    account.nature === AccountNature.REVENUE || account.nature === AccountNature.EXPENSE;

/** Valor no DRE: receita = crédito − débito; despesa = débito − crédito. */
export function amountOf(account: ReportAccount, movement: MonthlyMovement): Cents {
    return isRevenue(account) ? movement.credit - movement.debit : movement.debit - movement.credit;
}

function buildLines(bucket: Record<DreCategory, Cents>): DreLines {
    const netRevenue = bucket.GROSS_REVENUE - bucket.REVENUE_DEDUCTION;
    const grossProfit = netRevenue - bucket.COST_OF_SALES;
    const otherOperatingResult = bucket.OTHER_REVENUE - bucket.OTHER_EXPENSE;
    const operatingResult = grossProfit - bucket.OPERATING_EXPENSE + otherOperatingResult;
    const financialResult = bucket.FINANCIAL_REVENUE - bucket.FINANCIAL_EXPENSE;
    const resultBeforeTaxes = operatingResult + financialResult;
    return {
        grossRevenue: bucket.GROSS_REVENUE,
        revenueDeductions: bucket.REVENUE_DEDUCTION,
        netRevenue,
        costOfSales: bucket.COST_OF_SALES,
        grossProfit,
        operatingExpenses: bucket.OPERATING_EXPENSE,
        otherOperatingResult,
        operatingResult,
        financialRevenue: bucket.FINANCIAL_REVENUE,
        financialExpenses: bucket.FINANCIAL_EXPENSE,
        financialResult,
        resultBeforeTaxes,
        incomeTaxes: bucket.INCOME_TAX,
        netResult: resultBeforeTaxes - bucket.INCOME_TAX,
    };
}

function buildMonths(
    movements: readonly MonthlyMovement[],
    byId: ReadonlyMap<string, ReportAccount>,
): DreMonth[] {
    const months = new Map<string, { revenues: Cents; expenses: Cents }>();
    for (const movement of movements) {
        const account = byId.get(movement.accountId) as ReportAccount;
        const month = months.get(movement.month) ?? { revenues: 0, expenses: 0 };
        if (isRevenue(account)) month.revenues += amountOf(account, movement);
        else month.expenses += amountOf(account, movement);
        months.set(movement.month, month);
    }
    return [...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({ month, ...value, result: value.revenues - value.expenses }));
}

/**
 * DRE por função (CPC 26) a partir das contas do plano e das somas mensais do razão: linhas,
 * totais por natureza, árvores somadas, contas sem categoria e, se pedido, a série mensal.
 */
export function buildDre(
    accounts: readonly ReportAccount[],
    movements: readonly MonthlyMovement[],
    options: { byMonth: boolean },
): DreReport {
    const resultAccounts = accounts.filter(isResult);
    const byId = new Map(resultAccounts.map(account => [account.id, account]));
    const ownMovements = movements.filter(movement => byId.has(movement.accountId));
    const direct = new Map<string, Cents>();
    for (const movement of ownMovements) {
        const account = byId.get(movement.accountId) as ReportAccount;
        direct.set(account.id, (direct.get(account.id) ?? 0) + amountOf(account, movement));
    }

    const bucket = Object.fromEntries(Object.values(DreCategory).map(c => [c, 0])) as Record<
        DreCategory,
        Cents
    >;
    const totals = { revenues: 0, expenses: 0, result: 0 };
    const unclassified: UnclassifiedAccount[] = [];
    for (const account of resultAccounts) {
        const amount = direct.get(account.id);
        if (amount === undefined) continue;
        const category = dreCategoryRules.effective(
            account.nature,
            account.dreCategory,
        ) as DreCategory;
        bucket[category] += amount;
        if (isRevenue(account)) totals.revenues += amount;
        else totals.expenses += amount;
        if (account.dreCategory === null) {
            unclassified.push({
                accountId: account.id,
                code: account.code,
                name: account.name,
                nature: account.nature,
                amount,
            });
        }
    }
    totals.result = totals.revenues - totals.expenses;

    const tree = buildAccountTree(resultAccounts, direct, CENTS_OPS);
    return {
        lines: buildLines(bucket),
        totals,
        revenueTree: tree.filter(node => isRevenue(node.account)),
        expenseTree: tree.filter(node => !isRevenue(node.account)),
        unclassified,
        months: options.byMonth ? buildMonths(ownMovements, byId) : null,
    };
}
