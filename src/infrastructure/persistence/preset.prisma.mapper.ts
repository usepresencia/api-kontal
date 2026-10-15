import type { Prisma } from '@prisma/client';
import { PresetEntity } from '@/domain/entities/preset.entity.js';
import { PRESET_ROLES, type PresetRole } from '@/domain/ledger/preset-roles.js';
import type { PresetView } from '@/domain/repositories/preset.repository.interface.js';

/** Relações lidas junto com o preset (nome do plano e das contas). */
export const PRESET_REFS = {
    billingPlan: { select: { name: true } },
    accounts: { include: { account: { select: { name: true } } } },
} as const;

export type PresetWithRefs = Prisma.PresetGetPayload<{ include: typeof PRESET_REFS }>;

function emptyByRole<T>(): Record<PresetRole, T | null> {
    return Object.fromEntries(PRESET_ROLES.map(role => [role, null])) as Record<
        PresetRole,
        T | null
    >;
}

export function toPresetView(row: PresetWithRefs): PresetView {
    const accounts = emptyByRole<string>();
    const accountNames = emptyByRole<string>();
    for (const link of row.accounts) {
        accounts[link.role] = link.accountId;
        accountNames[link.role] = link.account.name;
    }
    return {
        preset: PresetEntity.fromPersistence({
            id: row.id,
            billingPlanId: row.billingPlanId,
            name: row.name,
            description: row.description,
            isActive: row.isActive,
            accounts,
            createdAt: row.createdAt,
        }),
        billingPlanName: row.billingPlan.name,
        accountNames,
    };
}

/** Linhas de `PresetAccount` correspondentes aos papéis preenchidos do preset. */
export function toAccountRows(preset: PresetEntity): { role: PresetRole; accountId: string }[] {
    return PRESET_ROLES.flatMap(role => {
        const accountId = preset.accounts[role];
        return accountId ? [{ role, accountId }] : [];
    });
}
