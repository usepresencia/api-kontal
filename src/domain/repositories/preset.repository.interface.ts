import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import type { PresetRole } from '@/domain/ledger/preset-roles.js';
import type { Page, PageRequest } from '@/domain/pagination.js';

/** Preset com os nomes do plano e das contas, lidos na mesma consulta. */
export interface PresetView {
    preset: PresetEntity;
    billingPlanName: string;
    accountNames: Record<PresetRole, string | null>;
}

export interface PresetFilter {
    billingPlanId?: string;
    isActive?: boolean;
}

export interface IPresetRepository {
    create(preset: PresetEntity): Promise<void>;
    /** Devolve o preset só se o plano dele pertence à empresa. */
    findById(companyId: string, id: string): Promise<PresetView | null>;
    list(companyId: string, filter: PresetFilter, page: PageRequest): Promise<Page<PresetView>>;
    update(companyId: string, preset: PresetEntity): Promise<void>;
    /** Indica se algum título usa o preset. */
    isInUse(id: string): Promise<boolean>;
    delete(companyId: string, id: string): Promise<void>;
}
