import { Inject, Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type {
    IPresetRepository,
    PresetFilter,
    PresetView,
} from '@/domain/repositories/preset.repository.interface.js';
import { PRESET_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListPresetsService {
    constructor(@Inject(PRESET_REPOSITORY) private readonly presets: IPresetRepository) {}

    execute(companyId: string, filter: PresetFilter, page: PageRequest): Promise<Page<PresetView>> {
        return this.presets.list(companyId, filter, page);
    }
}
