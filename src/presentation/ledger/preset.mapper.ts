import { PRESET_ROLES, type PresetRole } from '@/domain/ledger/preset-roles.js';
import type { PresetView } from '@/domain/repositories/preset.repository.interface.js';

/** Resposta da API para um preset, com id e nome de cada conta. */
export function toPresetResponse({ preset, billingPlanName, accountNames }: PresetView) {
    const accounts = Object.fromEntries(
        PRESET_ROLES.map(role => {
            const id = preset.accounts[role];
            return [role, id ? { id, name: accountNames[role] } : null];
        }),
    ) as Record<PresetRole, { id: string; name: string | null } | null>;
    return {
        id: preset.id,
        billingPlanId: preset.billingPlanId,
        billingPlanName,
        name: preset.name,
        description: preset.description,
        isActive: preset.isActive,
        accounts,
        createdAt: preset.createdAt.toISOString(),
    };
}
