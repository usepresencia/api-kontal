import type { GrantKontalAccessService } from '@/application/provisioning/grant-kontal-access.service.js';
import type { CreateCompanyService } from '@/application/companies/create-company.service.js';
import type { ListBillingPlansService } from '@/application/billing/list-billing-plans.service.js';
import type { ListCompaniesService } from '@/application/companies/list-companies.service.js';
import { normalizeCnpj } from '@/domain/companies/cnpj.js';
import type { CompanyData } from '@/domain/entities/company-profile.entity.js';
import {
    type AppliedTemplate,
    type PlanTemplateServices,
    applyPlanTemplate,
} from '@/scripts/apply-plan-template.js';
import type { PlanTemplate } from '@/scripts/templates/plan-template.js';
import {
    assertTemplateConsistent,
    countAccounts,
} from '@/scripts/templates/plan-template.index.js';

const PAGE_SIZE = 100;

export interface ProvisionCompanyServices extends PlanTemplateServices {
    createCompany: CreateCompanyService;
    listCompanies: ListCompaniesService;
    listPlans: ListBillingPlansService;
    grantAccess: GrantKontalAccessService;
}

export interface ProvisionCompanyInput {
    company: CompanyData;
    template: PlanTemplate;
    owners: readonly string[];
    /** Prefixo da chave de idempotência dos acessos, ex.: `presencia-ltda`. */
    eventPrefix: string;
    /** Sem `apply`, só descreve o que seria feito e não grava nada. */
    apply: boolean;
}

export interface ProvisionCompanyReport {
    applied: boolean;
    company: { id: string | null; status: 'existing' | 'created' | 'to-create' };
    plan: {
        status: 'existing' | 'created' | 'to-create';
        applied?: AppliedTemplate;
        accounts: number;
        presets: number;
    };
    owners: { email: string; status: 'granted' | 'already' | 'to-grant' }[];
}

/**
 * Cria a empresa, o plano de contas do modelo e o acesso `OWNER` dos usuários. Pode ser repetido:
 * reaproveita a empresa pelo CNPJ, pula o plano se já existe um com o nome do modelo e os
 * acessos são idempotentes pela chave do evento.
 */
export async function provisionCompany(
    services: ProvisionCompanyServices,
    input: ProvisionCompanyInput,
): Promise<ProvisionCompanyReport> {
    assertTemplateConsistent(input.template);
    const { company, template, owners, eventPrefix, apply } = input;
    const planSize = { accounts: countAccounts(template), presets: template.presets.length };

    let companyId = await findCompanyId(services.listCompanies, company.cnpj);
    const companyStatus = companyId ? 'existing' : apply ? 'created' : 'to-create';
    if (!companyId && apply) companyId = (await services.createCompany.execute(company)).id;

    const existingPlan = companyId
        ? await planNamed(services.listPlans, companyId, template.name)
        : false;
    let planReport: ProvisionCompanyReport['plan'] = {
        status: existingPlan ? 'existing' : apply ? 'created' : 'to-create',
        ...planSize,
    };
    if (companyId && !existingPlan && apply) {
        planReport = {
            ...planReport,
            applied: await applyPlanTemplate(services, companyId, template),
        };
    }

    const ownersReport: ProvisionCompanyReport['owners'] = [];
    for (const email of owners) {
        if (!apply || !companyId) {
            ownersReport.push({ email, status: 'to-grant' });
            continue;
        }
        const { alreadyProcessed } = await services.grantAccess.execute({
            eventId: `${eventPrefix}:owner:${email.toLowerCase()}`,
            email,
            companyId,
            role: 'OWNER',
        });
        ownersReport.push({ email, status: alreadyProcessed ? 'already' : 'granted' });
    }

    return {
        applied: apply,
        company: { id: companyId ?? null, status: companyStatus },
        plan: planReport,
        owners: ownersReport,
    };
}

async function findCompanyId(list: ListCompaniesService, cnpj: string): Promise<string | null> {
    const wanted = normalizeCnpj(cnpj);
    for (let page = 1; ; page += 1) {
        const result = await list.execute({ page, pageSize: PAGE_SIZE });
        const found = result.items.find(item => item.cnpj === wanted);
        if (found) return found.id;
        if (page * PAGE_SIZE >= result.total) return null;
    }
}

async function planNamed(
    list: ListBillingPlansService,
    companyId: string,
    name: string,
): Promise<boolean> {
    const page = await list.execute(companyId, { page: 1, pageSize: PAGE_SIZE });
    return page.items.some(plan => plan.name === name);
}
