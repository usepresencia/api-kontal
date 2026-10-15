import { Module } from '@nestjs/common';
import { CreateCompanyService } from '@/application/companies/create-company.service.js';
import { CreateLogoUploadSignatureService } from '@/application/companies/create-logo-upload-signature.service.js';
import { DeactivateCompanyService } from '@/application/companies/deactivate-company.service.js';
import { GetCurrentCompanyService } from '@/application/companies/get-current-company.service.js';
import { ListCompaniesService } from '@/application/companies/list-companies.service.js';
import { RemoveCompanyLogoService } from '@/application/companies/remove-company-logo.service.js';
import { SaveCompanyLogoService } from '@/application/companies/save-company-logo.service.js';
import { UpdateCurrentCompanyService } from '@/application/companies/update-current-company.service.js';
import { MediaModule } from '@/infrastructure/media/media.module.js';
import { CompanyController } from '@/presentation/companies/company.controller.js';
import { CompanyLogoController } from '@/presentation/companies/company-logo.controller.js';
import { PlatformCompaniesController } from '@/presentation/companies/platform-companies.controller.js';

@Module({
    imports: [MediaModule],
    controllers: [PlatformCompaniesController, CompanyController, CompanyLogoController],
    providers: [
        CreateCompanyService,
        ListCompaniesService,
        DeactivateCompanyService,
        GetCurrentCompanyService,
        UpdateCurrentCompanyService,
        CreateLogoUploadSignatureService,
        SaveCompanyLogoService,
        RemoveCompanyLogoService,
    ],
})
export class CompaniesModule {}
