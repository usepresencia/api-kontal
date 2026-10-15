import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetDreService } from '@/application/reports/get-dre.service.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';
import { toDreResponse } from '@/presentation/reports/dre.mapper.js';
import { type DreQuery, dreQuerySchema } from '@/presentation/reports/report.schemas.js';

@Controller('reports')
@UseGuards(TenantIsolationGuard)
export class ReportsController {
    constructor(private readonly getDre: GetDreService) {}

    @Get('dre')
    async dre(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(dreQuerySchema)) query: DreQuery,
    ) {
        return toDreResponse(await this.getDre.execute(companyId, query));
    }
}
