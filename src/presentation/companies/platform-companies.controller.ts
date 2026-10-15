import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CreateCompanyService } from '@/application/companies/create-company.service.js';
import { DeactivateCompanyService } from '@/application/companies/deactivate-company.service.js';
import { ListCompaniesService } from '@/application/companies/list-companies.service.js';
import { PlatformAdminGuard } from '@/infrastructure/auth/platform-admin.guard.js';
import { type PageQuery, pageQuerySchema } from '@/presentation/common/page-query.schema.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toCompanyResponse } from '@/presentation/companies/company.mapper.js';
import { type CompanyBody, companyBodySchema } from '@/presentation/companies/company.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

/** Rotas de plataforma: não usam `X-Tenant-Id`. */
@Controller('companies')
export class PlatformCompaniesController {
    constructor(
        private readonly createCompany: CreateCompanyService,
        private readonly listCompanies: ListCompaniesService,
        private readonly deactivateCompany: DeactivateCompanyService,
    ) {}

    @Post()
    @UseGuards(PlatformAdminGuard)
    async create(@Body(new ZodValidationPipe(companyBodySchema)) body: CompanyBody) {
        return toCompanyResponse(await this.createCompany.execute(body));
    }

    @Get()
    async list(@Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery) {
        return toPageResponse(await this.listCompanies.execute(query), toCompanyResponse);
    }

    @Delete(':id')
    @HttpCode(204)
    @UseGuards(PlatformAdminGuard)
    async deactivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
        await this.deactivateCompany.execute(id);
    }
}
