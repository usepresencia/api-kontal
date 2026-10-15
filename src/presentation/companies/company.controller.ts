import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { GetCurrentCompanyService } from '@/application/companies/get-current-company.service.js';
import { UpdateCurrentCompanyService } from '@/application/companies/update-current-company.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toCompanyResponse } from '@/presentation/companies/company.mapper.js';
import { type CompanyBody, companyBodySchema } from '@/presentation/companies/company.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

/** Empresa corrente, definida por `X-Tenant-Id`. */
@Controller('company')
@UseGuards(TenantIsolationGuard)
export class CompanyController {
    constructor(
        private readonly getCompany: GetCurrentCompanyService,
        private readonly updateCompany: UpdateCurrentCompanyService,
    ) {}

    @Get()
    async get(@TenantId() companyId: string) {
        return toCompanyResponse(await this.getCompany.execute(companyId));
    }

    @Put()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async update(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(companyBodySchema)) body: CompanyBody,
    ) {
        return toCompanyResponse(await this.updateCompany.execute(companyId, body));
    }
}
