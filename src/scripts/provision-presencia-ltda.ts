import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module.js';
import { CreateBillingAccountService } from '@/application/billing/create-billing-account.service.js';
import { CreateBillingPlanService } from '@/application/billing/create-billing-plan.service.js';
import { ListBillingPlansService } from '@/application/billing/list-billing-plans.service.js';
import { CreateCompanyService } from '@/application/companies/create-company.service.js';
import { ListCompaniesService } from '@/application/companies/list-companies.service.js';
import { CreatePresetService } from '@/application/ledger/presets/create-preset.service.js';
import { GrantKontalAccessService } from '@/application/provisioning/grant-kontal-access.service.js';
import { formatProvisionReport } from '@/scripts/format-provision-report.js';
import { provisionCompany } from '@/scripts/provision-company.js';
import { PRESENCIA_LTDA, PRESENCIA_LTDA_OWNERS } from '@/scripts/presencia-ltda.data.js';
import { TECH_COMPANY_PLAN } from '@/scripts/templates/tech-company.plan.js';

/**
 * Cria a Presencia Ltda no Kontal com o plano de contas de tecnologia e dá acesso OWNER aos
 * usuários. Sem `--apply` só simula. Uso: `node dist/scripts/provision-presencia-ltda.js [--apply]`.
 */
async function main(): Promise<void> {
    const apply = process.argv.includes('--apply');
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
    });
    try {
        const report = await provisionCompany(
            {
                createCompany: app.get(CreateCompanyService),
                listCompanies: app.get(ListCompaniesService),
                listPlans: app.get(ListBillingPlansService),
                createPlan: app.get(CreateBillingPlanService),
                createAccount: app.get(CreateBillingAccountService),
                createPreset: app.get(CreatePresetService),
                grantAccess: app.get(GrantKontalAccessService),
            },
            {
                company: PRESENCIA_LTDA,
                template: TECH_COMPANY_PLAN,
                owners: PRESENCIA_LTDA_OWNERS,
                eventPrefix: 'presencia-ltda',
                apply,
            },
        );
        console.log(formatProvisionReport(report));
    } finally {
        await app.close();
    }
}

main().catch((error: unknown) => {
    console.error('Falha na provisão:', error instanceof Error ? error.message : error);
    process.exit(1);
});
