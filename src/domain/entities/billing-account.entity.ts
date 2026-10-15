import type { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountType } from '@/domain/billing/account-type.js';
import { type BalanceCategory, balanceCategoryRules } from '@/domain/billing/balance-category.js';
import { type DreCategory, dreCategoryRules } from '@/domain/billing/dre-category.js';
import { requiredText } from '@/domain/required-text.js';

export interface BillingAccountRow {
    id: string;
    billingPlanId: string;
    parentId: string | null;
    name: string;
    accountType: AccountType;
    nature: AccountNature;
    dreCategory: DreCategory | null;
    balanceCategory: BalanceCategory | null;
    isActive: boolean;
    code: string;
    level: number;
    createdAt: Date;
}

/** Conta ainda sem código: o repositório gera o código ao inserir. */
export interface NewBillingAccount {
    id: string;
    billingPlanId: string;
    parentId: string | null;
    name: string;
    accountType: AccountType;
    nature: AccountNature;
    dreCategory: DreCategory | null;
    balanceCategory: BalanceCategory | null;
    isActive: boolean;
    level: number;
}

export class BillingAccountEntity {
    private constructor(
        readonly id: string,
        readonly billingPlanId: string,
        readonly parentId: string | null,
        readonly name: string,
        readonly accountType: AccountType,
        readonly nature: AccountNature,
        readonly dreCategory: DreCategory | null,
        readonly balanceCategory: BalanceCategory | null,
        readonly isActive: boolean,
        readonly code: string,
        readonly level: number,
        readonly createdAt: Date,
    ) {}

    /** Valida os dados de uma conta nova (o código é gerado na inserção). */
    static draft(params: {
        id: string;
        billingPlanId: string;
        parentId: string | null;
        name: string;
        accountType: AccountType;
        nature: AccountNature;
        dreCategory: DreCategory | null;
        balanceCategory: BalanceCategory | null;
        isActive?: boolean;
        level: number;
    }): NewBillingAccount {
        return {
            id: params.id,
            billingPlanId: params.billingPlanId,
            parentId: params.parentId,
            name: requiredText(params.name, 'Nome da conta'),
            accountType: params.accountType,
            nature: params.nature,
            dreCategory: params.dreCategory,
            balanceCategory: params.balanceCategory,
            isActive: params.isActive ?? true,
            level: params.level,
        };
    }

    /**
     * Altera nome, status, tipo e categorias; código, nível, natureza, plano e pai são imutáveis.
     * @throws DomainError DRE_CATEGORY_INVALID, BALANCE_CATEGORY_INVALID
     */
    withChanges(changes: {
        name?: string;
        isActive?: boolean;
        accountType?: AccountType;
        dreCategory?: DreCategory | null;
        balanceCategory?: BalanceCategory | null;
    }): BillingAccountEntity {
        const dreCategory =
            changes.dreCategory === undefined ? this.dreCategory : changes.dreCategory;
        const balanceCategory =
            changes.balanceCategory === undefined ? this.balanceCategory : changes.balanceCategory;
        dreCategoryRules.assert(this.nature, dreCategory);
        balanceCategoryRules.assert(this.nature, balanceCategory);
        return new BillingAccountEntity(
            this.id,
            this.billingPlanId,
            this.parentId,
            changes.name === undefined ? this.name : requiredText(changes.name, 'Nome da conta'),
            changes.accountType ?? this.accountType,
            this.nature,
            dreCategory,
            balanceCategory,
            changes.isActive ?? this.isActive,
            this.code,
            this.level,
            this.createdAt,
        );
    }

    static fromPersistence(row: BillingAccountRow): BillingAccountEntity {
        return new BillingAccountEntity(
            row.id,
            row.billingPlanId,
            row.parentId,
            row.name,
            row.accountType,
            row.nature,
            row.dreCategory,
            row.balanceCategory,
            row.isActive,
            row.code,
            row.level,
            row.createdAt,
        );
    }
}
