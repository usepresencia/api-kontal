import { Inject, Injectable } from '@nestjs/common';
import { requirePreset } from '@/application/ledger/require-preset.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { IPresetRepository } from '@/domain/repositories/preset.repository.interface.js';
import { PRESET_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class DeletePresetService {
    constructor(@Inject(PRESET_REPOSITORY) private readonly presets: IPresetRepository) {}

    /**
     * Exclui o preset da empresa.
     * @throws DomainError PRESET_IN_USE se algum título usa o preset
     */
    async execute(companyId: string, id: string): Promise<void> {
        await requirePreset(this.presets, companyId, id);
        if (await this.presets.isInUse(id)) {
            throw new DomainError(
                ErrorCode.PRESET_IN_USE,
                'Exclusão bloqueada: o preset está em uso',
            );
        }
        await this.presets.delete(companyId, id);
    }
}
