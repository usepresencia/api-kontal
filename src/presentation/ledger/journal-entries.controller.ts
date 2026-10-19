import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CreateManualEntryService } from '@/application/ledger/journal/create-manual-entry.service.js';
import { GetJournalEntryService } from '@/application/ledger/journal/get-journal-entry.service.js';
import { ListJournalEntriesService } from '@/application/ledger/journal/list-journal-entries.service.js';
import { ReverseManualEntryService } from '@/application/ledger/journal/reverse-manual-entry.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toJournalResponse } from '@/presentation/ledger/journal.mapper.js';
import {
    type CreateManualEntryBody,
    createManualEntrySchema,
    type ListJournalEntriesQuery,
    listJournalEntriesQuerySchema,
    type ReverseManualEntryBody,
    reverseManualEntrySchema,
} from '@/presentation/ledger/journal.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('journal-entries')
@UseGuards(TenantIsolationGuard)
export class JournalEntriesController {
    constructor(
        private readonly getEntry: GetJournalEntryService,
        private readonly listEntries: ListJournalEntriesService,
        private readonly createEntry: CreateManualEntryService,
        private readonly reverseEntry: ReverseManualEntryService,
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

    @Post()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async create(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(createManualEntrySchema)) body: CreateManualEntryBody,
    ) {
        return toJournalResponse(await this.createEntry.execute(companyId, body));
    }

    @Post(':id/reverse')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async reverse(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ZodValidationPipe(reverseManualEntrySchema)) body: ReverseManualEntryBody,
    ) {
        return toJournalResponse(await this.reverseEntry.execute(companyId, id, body));
    }
}
