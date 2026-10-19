import type { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountType } from '@/domain/billing/account-type.js';
import type { BalanceCategory } from '@/domain/billing/balance-category.js';
import type { CostBehavior } from '@/domain/billing/cost-behavior.js';
import type { DreCategory } from '@/domain/billing/dre-category.js';
import type { PresetRole } from '@/domain/ledger/preset-roles.js';

/** Conta do modelo; filhas herdam natureza e categorias quando não informadas. */
export interface PlanNode {
    /** Identifica a conta para os presets do modelo. */
    key?: string;
    name: string;
    type: AccountType;
    nature?: AccountNature;
    dre?: DreCategory;
    balance?: BalanceCategory;
    cost?: CostBehavior;
    children?: PlanNode[];
}

export interface PresetTemplate {
    name: string;
    description: string;
    /** Papéis do preset e a `key` da conta de cada um. */
    accounts: Partial<Record<PresetRole, string>>;
}

export interface PlanTemplate {
    name: string;
    description: string;
    roots: PlanNode[];
    presets: PresetTemplate[];
}

const S = 'SYNTHETIC' as const;
const A = 'ANALYTIC' as const;

/** Conta analítica. */
export const leaf = (name: string, key?: string, cost?: CostBehavior): PlanNode => ({
    name,
    type: A,
    ...(key ? { key } : {}),
    ...(cost ? { cost } : {}),
});

/** Conta sintética com filhas. */
export const group = (
    name: string,
    children: PlanNode[],
    rest: Partial<Omit<PlanNode, 'name' | 'type' | 'children'>> = {},
): PlanNode => ({ name, type: S, ...rest, children });

export { A as ANALYTIC, S as SYNTHETIC };
