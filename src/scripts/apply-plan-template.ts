import type { CreateBillingAccountService } from '@/application/billing/create-billing-account.service.js';
import type { CreateBillingPlanService } from '@/application/billing/create-billing-plan.service.js';
import type { CreatePresetService } from '@/application/ledger/presets/create-preset.service.js';
import type { PresetRole } from '@/domain/ledger/preset-roles.js';
import type { PlanNode, PlanTemplate } from '@/scripts/templates/plan-template.js';
import { assertTemplateConsistent } from '@/scripts/templates/plan-template.index.js';

export interface PlanTemplateServices {
    createPlan: CreateBillingPlanService;
    createAccount: CreateBillingAccountService;
    createPreset: CreatePresetService;
}

export interface AppliedTemplate {
    planId: string;
    accounts: number;
    presets: number;
}

/** Cria o plano, a árvore de contas e os presets do modelo na empresa, pelos serviços de domínio. */
export async function applyPlanTemplate(
    services: PlanTemplateServices,
    companyId: string,
    template: PlanTemplate,
): Promise<AppliedTemplate> {
    assertTemplateConsistent(template);

    const plan = await services.createPlan.execute(companyId, {
        name: template.name,
        description: template.description,
    });
    const idByKey = new Map<string, string>();
    let accounts = 0;

    const create = async (node: PlanNode, parentId: string | null): Promise<void> => {
        const { account } = await services.createAccount.execute(companyId, {
            billingPlanId: plan.id,
            parentId,
            name: node.name,
            accountType: node.type,
            nature: node.nature,
            dreCategory: node.dre,
            balanceCategory: node.balance,
            costBehavior: node.cost,
        });
        accounts += 1;
        if (node.key) idByKey.set(node.key, account.id);
        for (const child of node.children ?? []) await create(child, account.id);
    };
    for (const root of template.roots) await create(root, null);

    for (const preset of template.presets) {
        const accountIds = Object.fromEntries(
            Object.entries(preset.accounts).map(([role, key]) => [role, idByKey.get(key) ?? null]),
        ) as Partial<Record<PresetRole, string | null>>;
        await services.createPreset.execute(companyId, {
            billingPlanId: plan.id,
            name: preset.name,
            description: preset.description,
            accounts: accountIds,
        });
    }
    return { planId: plan.id, accounts, presets: template.presets.length };
}
