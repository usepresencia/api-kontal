import { Inject, Injectable } from '@nestjs/common';
import { requirePreset } from '@/application/ledger/require-preset.js';
import type {
    IPresetRepository,
    PresetView,
} from '@/domain/repositories/preset.repository.interface.js';
import { PRESET_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class GetPresetService {
    constructor(@Inject(PRESET_REPOSITORY) private readonly presets: IPresetRepository) {}

    execute(companyId: string, id: string): Promise<PresetView> {
        return requirePreset(this.presets, companyId, id);
    }
}
