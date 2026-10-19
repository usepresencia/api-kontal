import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { DeleteEntryService } from '@/application/ledger/entries/delete-entry.service.js';
import { GetEntryService } from '@/application/ledger/entries/get-entry.service.js';
import { ListEntriesService } from '@/application/ledger/entries/list-entries.service.js';
import { UpdateEntryService } from '@/application/ledger/entries/update-entry.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toEntryResponse } from '@/presentation/ledger/entry.mapper.js';
import {
    type ListEntriesQuery,
    listEntriesQuerySchema,
    type UpdateEntryBody,
    updateEntrySchema,
} from '@/presentation/ledger/entry.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('entries')
@UseGuards(TenantIsolationGuard)
export class EntriesController {
    constructor(
        private readonly updateEntry: UpdateEntryService,
        private readonly deleteEntry: DeleteEntryService,
        private readonly getEntry: GetEntryService,
        private readonly listEntries: ListEntriesService,
    ) {}

    @Get()
    async list(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(listEntriesQuerySchema)) query: ListEntriesQuery,
    ) {
        const { page, pageSize, ...filter } = query;
        return toPageResponse(
            await this.listEntries.execute(companyId, filter, { page, pageSize }),
            toEntryResponse,
        );
    }

    @Get(':id')
    async get(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        return toEntryResponse(await this.getEntry.execute(companyId, id));
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async update(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ZodValidationPipe(updateEntrySchema)) body: UpdateEntryBody,
    ) {
        return toEntryResponse(await this.updateEntry.execute(companyId, id, body));
    }

    @Delete(':id')
    @HttpCode(204)
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async remove(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<void> {
        await this.deleteEntry.execute(companyId, id);
    }
}
