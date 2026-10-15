import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type {
    IPresetRepository,
    PresetView,
} from '@/domain/repositories/preset.repository.interface.js';

/**
 * Carrega o preset da empresa.
 * @throws DomainError PRESET_NOT_FOUND (inclusive para preset de outra empresa)
 */
export async function requirePreset(
    presets: IPresetRepository,
    companyId: string,
    id: string,
): Promise<PresetView> {
    const view = await presets.findById(companyId, id);
    if (!view) throw new DomainError(ErrorCode.PRESET_NOT_FOUND, 'Preset não encontrado');
    return view;
}
