import { Module } from '@nestjs/common';
import { GetJournalEntryService } from '@/application/ledger/journal/get-journal-entry.service.js';
import { ListJournalEntriesService } from '@/application/ledger/journal/list-journal-entries.service.js';
import { CreateEntryService } from '@/application/ledger/entries/create-entry.service.js';
import { DeleteEntryService } from '@/application/ledger/entries/delete-entry.service.js';
import { GetEntryService } from '@/application/ledger/entries/get-entry.service.js';
import { ListEntriesService } from '@/application/ledger/entries/list-entries.service.js';
import { UpdateEntryService } from '@/application/ledger/entries/update-entry.service.js';
import { CreatePresetService } from '@/application/ledger/presets/create-preset.service.js';
import { DeletePresetService } from '@/application/ledger/presets/delete-preset.service.js';
import { GetPresetService } from '@/application/ledger/presets/get-preset.service.js';
import { ListPresetsService } from '@/application/ledger/presets/list-presets.service.js';
import { UpdatePresetService } from '@/application/ledger/presets/update-preset.service.js';
import { CancelTitleSeriesService } from '@/application/ledger/series/cancel-title-series.service.js';
import { CreateTitleSeriesService } from '@/application/ledger/series/create-title-series.service.js';
import { ExtendTitleSeriesService } from '@/application/ledger/series/extend-title-series.service.js';
import { GetTitleSeriesService } from '@/application/ledger/series/get-title-series.service.js';
import { ListTitleSeriesService } from '@/application/ledger/series/list-title-series.service.js';
import { CreateTitleService } from '@/application/ledger/titles/create-title.service.js';
import { DeleteTitleService } from '@/application/ledger/titles/delete-title.service.js';
import { GetTitleService } from '@/application/ledger/titles/get-title.service.js';
import { ListTitlesService } from '@/application/ledger/titles/list-titles.service.js';
import { UpdateTitleService } from '@/application/ledger/titles/update-title.service.js';
import { WriteOffTitleService } from '@/application/ledger/titles/write-off-title.service.js';
import { EntriesController } from '@/presentation/ledger/entries.controller.js';
import { JournalEntriesController } from '@/presentation/ledger/journal-entries.controller.js';
import { PresetsController } from '@/presentation/ledger/presets.controller.js';
import { TitleEntriesController } from '@/presentation/ledger/title-entries.controller.js';
import { TitleSeriesController } from '@/presentation/ledger/title-series.controller.js';
import { TitlesController } from '@/presentation/ledger/titles.controller.js';

@Module({
    controllers: [
        PresetsController,
        TitlesController,
        TitleEntriesController,
        EntriesController,
        TitleSeriesController,
        JournalEntriesController,
    ],
    providers: [
        CreatePresetService,
        UpdatePresetService,
        DeletePresetService,
        GetPresetService,
        ListPresetsService,
        CreateTitleService,
        UpdateTitleService,
        DeleteTitleService,
        WriteOffTitleService,
        GetTitleService,
        ListTitlesService,
        CreateEntryService,
        UpdateEntryService,
        DeleteEntryService,
        GetEntryService,
        ListEntriesService,
        CreateTitleSeriesService,
        ExtendTitleSeriesService,
        CancelTitleSeriesService,
        GetTitleSeriesService,
        ListTitleSeriesService,
        GetJournalEntryService,
        ListJournalEntriesService,
    ],
})
export class LedgerModule {}
