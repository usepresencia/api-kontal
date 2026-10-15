import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetDreService } from '@/application/reports/get-dre.service.js';
import { GetTrialBalanceService } from '@/application/reports/get-trial-balance.service.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';
import { toDreResponse } from '@/presentation/reports/dre.mapper.js';
import {
    type DreQuery,
    dreQuerySchema,
    type TrialBalanceQuery,
    trialBalanceQuerySchema,
} from '@/presentation/reports/report.schemas.js';
import { toTrialBalanceResponse } from '@/presentation/reports/trial-balance.mapper.js';

@Controller('reports')
@UseGuards(TenantIsolationGuard)
export class ReportsController {
    constructor(
        private readonly getDre: GetDreService,
        private readonly getTrialBalance: GetTrialBalanceService,
    ) {}

    @Get('dre')
    async dre(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(dreQuerySchema)) query: DreQuery,
    ) {
        return toDreResponse(await this.getDre.execute(companyId, query));
    }

    @Get('trial-balance')
    async trialBalance(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(trialBalanceQuerySchema)) query: TrialBalanceQuery,
    ) {
        return toTrialBalanceResponse(await this.getTrialBalance.execute(companyId, query));
    }
}
