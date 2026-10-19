import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ClosePeriodService } from '@/application/ledger/periods/close-period.service.js';
import { ListPeriodClosingsService } from '@/application/ledger/periods/list-period-closings.service.js';
import { ReopenPeriodService } from '@/application/ledger/periods/reopen-period.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import {
    type ClosePeriodBody,
    closePeriodSchema,
} from '@/presentation/ledger/period-closing.schemas.js';
import {
    toPeriodClosingResponse,
    toPeriodClosingsResponse,
} from '@/presentation/ledger/period-closing.mapper.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('period-closings')
@UseGuards(TenantIsolationGuard)
export class PeriodClosingsController {
    constructor(
        private readonly closePeriod: ClosePeriodService,
        private readonly listClosings: ListPeriodClosingsService,
        private readonly reopenPeriod: ReopenPeriodService,
    ) {}

    @Get()
    async list(@TenantId() companyId: string) {
        return toPeriodClosingsResponse(await this.listClosings.execute(companyId));
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async close(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(closePeriodSchema)) body: ClosePeriodBody,
    ) {
        return toPeriodClosingResponse(await this.closePeriod.execute(companyId, body));
    }

    @Delete('latest')
    @HttpCode(204)
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async reopen(@TenantId() companyId: string): Promise<void> {
        await this.reopenPeriod.execute(companyId);
    }
}
