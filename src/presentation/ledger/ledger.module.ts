import { Module } from '@nestjs/common';
import { CreatePresetService } from '@/application/ledger/presets/create-preset.service.js';
import { DeletePresetService } from '@/application/ledger/presets/delete-preset.service.js';
import { GetPresetService } from '@/application/ledger/presets/get-preset.service.js';
import { ListPresetsService } from '@/application/ledger/presets/list-presets.service.js';
import { UpdatePresetService } from '@/application/ledger/presets/update-preset.service.js';
import { PresetsController } from '@/presentation/ledger/presets.controller.js';

@Module({
    controllers: [PresetsController],
    providers: [
        CreatePresetService,
        UpdatePresetService,
        DeletePresetService,
        GetPresetService,
        ListPresetsService,
    ],
})
export class LedgerModule {}
