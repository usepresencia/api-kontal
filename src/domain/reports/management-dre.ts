import { CostBehavior } from '@/domain/billing/cost-behavior.js';
import { DreCategory, dreCategoryRules } from '@/domain/billing/dre-category.js';
import type { Cents } from '@/domain/money.js';
import { amountOf, isResult, isRevenue, type UnclassifiedAccount } from '@/domain/reports/dre.js';
import type { MonthlyMovement } from '@/domain/reports/ledger-rows.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';

export interface ManagementDreLines {
    grossRevenue: Cents;
    revenueDeductions: Cents;
    netRevenue: Cents;
    variableCosts: Cents;
    contributionMargin: Cents;
    fixedCosts: Cents;
    otherRevenue: Cents;
    resultBeforeDepreciation: Cents;
    depreciation: Cents;
    operatingResult: Cents;
    financialRevenue: Cents;
    financialExpenses: Cents;
    financialResult: Cents;
    resultBeforeTaxes: Cents;
    incomeTaxes: Cents;
    netResult: Cents;
}

export interface ManagementDreMonth {
    month: string;
    netRevenue: Cents;
    contributionMargin: Cents;
    operatingResult: Cents;
    netResult: Cents;
}

export interface ManagementDreReport {
    lines: ManagementDreLines;
    contributionMarginBps: number | null;
    unclassified: UnclassifiedAccount[];
    months: ManagementDreMonth[] | null;
}

/** Margem sobre a receita líquida em pontos-base (1234 = 12,34%), meio para longe do zero. */
export function marginBps(margin: Cents, netRevenue: Cents): number | null {
    if (netRevenue === 0) return null;
    const numerator = BigInt(margin) * 10000n;
    const denominator = BigInt(netRevenue);
    const negative = numerator < 0n !== denominator < 0n;
    const absNumerator = numerator < 0n ? -numerator : numerator;
    const absDenominator = denominator < 0n ? -denominator : denominator;
    const quotient = (2n * absNumerator + absDenominator) / (2n * absDenominator);
    return Number(negative ? -quotient : quotient);
}

function behaviorOf(account: ReportAccount, category: DreCategory): CostBehavior {
    if (account.costBehavior !== null) return account.costBehavior;
    return category === DreCategory.COST_OF_SALES ? CostBehavior.VARIABLE : CostBehavior.FIXED;
}

function computeLines(
    accounts: readonly ReportAccount[],
    direct: ReadonlyMap<string, Cents>,
): { lines: ManagementDreLines; unclassified: UnclassifiedAccount[] } {
    const sum = {
        gross: 0,
        otherRevenue: 0,
        financialRevenue: 0,
        deductions: 0,
        financialExpenses: 0,
        incomeTaxes: 0,
        variable: 0,
        fixed: 0,
        depreciation: 0,
    };
    const unclassified: UnclassifiedAccount[] = [];
    for (const account of accounts) {
        const amount = direct.get(account.id);
        if (amount === undefined) continue;
        const category = dreCategoryRules.effective(
            account.nature,
            account.dreCategory,
        ) as DreCategory;
        if (isRevenue(account)) {
            if (category === DreCategory.GROSS_REVENUE) sum.gross += amount;
            else if (category === DreCategory.OTHER_REVENUE) sum.otherRevenue += amount;
            else sum.financialRevenue += amount;
        } else if (category === DreCategory.REVENUE_DEDUCTION) sum.deductions += amount;
        else if (category === DreCategory.FINANCIAL_EXPENSE) sum.financialExpenses += amount;
        else if (category === DreCategory.INCOME_TAX) sum.incomeTaxes += amount;
        else {
            const behavior = behaviorOf(account, category);
            if (behavior === CostBehavior.VARIABLE) sum.variable += amount;
            else if (behavior === CostBehavior.FIXED) sum.fixed += amount;
            else sum.depreciation += amount;
            if (account.costBehavior === null) {
                unclassified.push({
                    accountId: account.id,
                    code: account.code,
                    name: account.name,
                    nature: account.nature,
                    amount,
                });
            }
        }
    }
    const netRevenue = sum.gross - sum.deductions;
    const contributionMargin = netRevenue - sum.variable;
    const resultBeforeDepreciation = contributionMargin - sum.fixed + sum.otherRevenue;
    const operatingResult = resultBeforeDepreciation - sum.depreciation;
    const financialResult = sum.financialRevenue - sum.financialExpenses;
    const resultBeforeTaxes = operatingResult + financialResult;
    return {
        unclassified,
        lines: {
            grossRevenue: sum.gross,
            revenueDeductions: sum.deductions,
            netRevenue,
            variableCosts: sum.variable,
            contributionMargin,
            fixedCosts: sum.fixed,
            otherRevenue: sum.otherRevenue,
            resultBeforeDepreciation,
            depreciation: sum.depreciation,
            operatingResult,
            financialRevenue: sum.financialRevenue,
            financialExpenses: sum.financialExpenses,
            financialResult,
            resultBeforeTaxes,
            incomeTaxes: sum.incomeTaxes,
            netResult: resultBeforeTaxes - sum.incomeTaxes,
        },
    };
}

function directAmounts(
    byId: ReadonlyMap<string, ReportAccount>,
    movements: readonly MonthlyMovement[],
): Map<string, Cents> {
    const direct = new Map<string, Cents>();
    for (const movement of movements) {
        const account = byId.get(movement.accountId) as ReportAccount;
        direct.set(account.id, (direct.get(account.id) ?? 0) + amountOf(account, movement));
    }
    return direct;
}

/**
 * DRE gerencial a partir das contas do plano e das somas mensais do razão: margem de contribuição
 * (custos variáveis), custos fixos, depreciação, resultado financeiro e impostos; o resultado
 * líquido é o mesmo do DRE contábil.
 */
export function buildManagementDre(
    accounts: readonly ReportAccount[],
    movements: readonly MonthlyMovement[],
    options: { byMonth: boolean },
): ManagementDreReport {
    const resultAccounts = accounts.filter(isResult);
    const byId = new Map(resultAccounts.map(account => [account.id, account]));
    const own = movements.filter(movement => byId.has(movement.accountId));
    const { lines, unclassified } = computeLines(resultAccounts, directAmounts(byId, own));
    let months: ManagementDreMonth[] | null = null;
    if (options.byMonth) {
        const keys = [...new Set(own.map(movement => movement.month))].sort();
        months = keys.map(month => {
            const monthLines = computeLines(
                resultAccounts,
                directAmounts(
                    byId,
                    own.filter(movement => movement.month === month),
                ),
            ).lines;
            return {
                month,
                netRevenue: monthLines.netRevenue,
                contributionMargin: monthLines.contributionMargin,
                operatingResult: monthLines.operatingResult,
                netResult: monthLines.netResult,
            };
        });
    }
    return {
        lines,
        contributionMarginBps: marginBps(lines.contributionMargin, lines.netRevenue),
        unclassified,
        months,
    };
}
