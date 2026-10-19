import type { Prisma } from '@prisma/client';
import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import type { IPresetTxRepository } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { PRESET_REFS, toPresetView } from '@/infrastructure/persistence/preset.prisma.mapper.js';

export class PresetTxRepository implements IPresetTxRepository {
    constructor(private readonly client: Prisma.TransactionClient) {}

    async find(companyId: string, id: string): Promise<PresetEntity | null> {
        const row = await this.client.preset.findFirst({
            where: { id, billingPlan: { companyId } },
            include: PRESET_REFS,
            relationLoadStrategy: 'join',
        });
        return row ? toPresetView(row).preset : null;
    }
}
