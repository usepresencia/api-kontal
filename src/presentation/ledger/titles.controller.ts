import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CreateTitleService } from '@/application/ledger/titles/create-title.service.js';
import { DeleteTitleService } from '@/application/ledger/titles/delete-title.service.js';
import { GetTitleService } from '@/application/ledger/titles/get-title.service.js';
import { ListTitlesService } from '@/application/ledger/titles/list-titles.service.js';
import { UpdateTitleService } from '@/application/ledger/titles/update-title.service.js';
import { WriteOffTitleService } from '@/application/ledger/titles/write-off-title.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toEntryResponse } from '@/presentation/ledger/entry.mapper.js';
import { toTitleResponse } from '@/presentation/ledger/title.mapper.js';
import {
    type CreateTitleBody,
    createTitleSchema,
    type ListTitlesQuery,
    listTitlesQuerySchema,
    type UpdateTitleBody,
    updateTitleSchema,
    type WriteOffBody,
    writeOffSchema,
} from '@/presentation/ledger/title.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('titles')
@UseGuards(TenantIsolationGuard)
export class TitlesController {
    constructor(
        private readonly createTitle: CreateTitleService,
        private readonly updateTitle: UpdateTitleService,
        private readonly deleteTitle: DeleteTitleService,
        private readonly writeOffTitle: WriteOffTitleService,
        private readonly getTitle: GetTitleService,
        private readonly listTitles: ListTitlesService,
    ) {}

    @Get()
    async list(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(listTitlesQuerySchema)) query: ListTitlesQuery,
    ) {
        const { page, pageSize, ...filter } = query;
        return toPageResponse(
            await this.listTitles.execute(companyId, filter, { page, pageSize }),
            view => toTitleResponse(view.title, view.presetName),
        );
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async create(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(createTitleSchema)) body: CreateTitleBody,
    ) {
        const view = await this.createTitle.execute(companyId, body);
        return toTitleResponse(view.title, view.presetName);
    }

    @Get(':id')
    async get(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        const view = await this.getTitle.execute(companyId, id);
        return toTitleResponse(view.title, view.presetName);
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async update(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ZodValidationPipe(updateTitleSchema)) body: UpdateTitleBody,
    ) {
        const { description, expirationDate, feesPercentageMonthly, ...locked } = body;
        const view = await this.updateTitle.execute(companyId, id, {
            description,
            expirationDate,
            feesPercentageMonthly,
            locked,
        });
        return toTitleResponse(view.title, view.presetName);
    }

    @Delete(':id')
    @HttpCode(204)
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async remove(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<void> {
        await this.deleteTitle.execute(companyId, id);
    }

    @Post(':id/write-off')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async writeOff(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ZodValidationPipe(writeOffSchema)) body: WriteOffBody,
    ) {
        return toEntryResponse(await this.writeOffTitle.execute(companyId, id, body));
    }
}
