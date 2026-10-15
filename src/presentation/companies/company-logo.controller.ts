import { Body, Controller, Delete, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { CreateLogoUploadSignatureService } from '@/application/companies/create-logo-upload-signature.service.js';
import { RemoveCompanyLogoService } from '@/application/companies/remove-company-logo.service.js';
import { SaveCompanyLogoService } from '@/application/companies/save-company-logo.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toCompanyResponse } from '@/presentation/companies/company.mapper.js';
import { type SaveLogoBody, saveLogoSchema } from '@/presentation/companies/company.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

/** Logo da empresa corrente: o front sobe a imagem direto ao Cloudinary com a assinatura. */
@Controller('company/logo')
@UseGuards(TenantIsolationGuard, RolesGuard)
@Roles(...WRITE_ROLES)
export class CompanyLogoController {
    constructor(
        private readonly createSignature: CreateLogoUploadSignatureService,
        private readonly saveLogo: SaveCompanyLogoService,
        private readonly removeLogo: RemoveCompanyLogoService,
    ) {}

    @Post('signature')
    @HttpCode(200)
    signature(@TenantId() companyId: string) {
        return this.createSignature.execute(companyId);
    }

    @Put()
    async save(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(saveLogoSchema)) body: SaveLogoBody,
    ) {
        return toCompanyResponse(await this.saveLogo.execute(companyId, body.url));
    }

    @Delete()
    @HttpCode(204)
    async remove(@TenantId() companyId: string): Promise<void> {
        await this.removeLogo.execute(companyId);
    }
}
