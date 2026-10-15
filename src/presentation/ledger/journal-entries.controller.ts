import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { GetJournalEntryService } from '@/application/ledger/journal/get-journal-entry.service.js';
import { ListJournalEntriesService } from '@/application/ledger/journal/list-journal-entries.service.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toJournalResponse } from '@/presentation/ledger/journal.mapper.js';
import {
    type ListJournalEntriesQuery,
    listJournalEntriesQuerySchema,
} from '@/presentation/ledger/journal.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('journal-entries')
@UseGuards(TenantIsolationGuard)
export class JournalEntriesController {
    constructor(
        private readonly getEntry: GetJournalEntryService,
        private readonly listEntries: ListJournalEntriesService,
    ) {}

    @Get()
    async list(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(listJournalEntriesQuerySchema)) query: ListJournalEntriesQuery,
    ) {
        const { page, pageSize, ...filter } = query;
        return toPageResponse(
            await this.listEntries.execute(companyId, filter, { page, pageSize }),
            toJournalResponse,
        );
    }

    @Get(':id')
    async get(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        return toJournalResponse(await this.getEntry.execute(companyId, id));
    }
}
