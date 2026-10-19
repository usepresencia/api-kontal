import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CancelTitleSeriesService } from '@/application/ledger/series/cancel-title-series.service.js';
import { CreateTitleSeriesService } from '@/application/ledger/series/create-title-series.service.js';
import { ExtendTitleSeriesService } from '@/application/ledger/series/extend-title-series.service.js';
import { GetTitleSeriesService } from '@/application/ledger/series/get-title-series.service.js';
import { ListTitleSeriesService } from '@/application/ledger/series/list-title-series.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import {
    type CreateSeriesBody,
    createSeriesSchema,
    type ExtendSeriesBody,
    extendSeriesSchema,
    type ListSeriesQuery,
    listSeriesQuerySchema,
} from '@/presentation/ledger/series.schemas.js';
import { toSeriesDetailResponse, toSeriesResponse } from '@/presentation/ledger/series.mapper.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('title-series')
@UseGuards(TenantIsolationGuard)
export class TitleSeriesController {
    constructor(
        private readonly createSeries: CreateTitleSeriesService,
        private readonly extendSeries: ExtendTitleSeriesService,
        private readonly cancelSeries: CancelTitleSeriesService,
        private readonly getSeries: GetTitleSeriesService,
        private readonly listSeries: ListTitleSeriesService,
    ) {}

    @Get()
    async list(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(listSeriesQuerySchema)) query: ListSeriesQuery,
    ) {
        const { page, pageSize, ...filter } = query;
        return toPageResponse(
            await this.listSeries.execute(companyId, filter, { page, pageSize }),
            toSeriesResponse,
        );
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async create(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(createSeriesSchema)) body: CreateSeriesBody,
    ) {
        const { series, titles } = await this.createSeries.execute(companyId, body);
        return toSeriesDetailResponse(series, titles);
    }

    @Get(':id')
    async get(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        const { series, titles } = await this.getSeries.execute(companyId, id);
        return toSeriesDetailResponse(series, titles);
    }

    @Post(':id/extend')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async extend(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ZodValidationPipe(extendSeriesSchema)) body: ExtendSeriesBody,
    ) {
        const { series, titles } = await this.extendSeries.execute(companyId, id, body);
        return toSeriesDetailResponse(series, titles);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    cancel(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        return this.cancelSeries.execute(companyId, id);
    }
}
