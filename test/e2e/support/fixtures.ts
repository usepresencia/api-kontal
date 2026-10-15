import { randomUUID } from 'node:crypto';
import { toSortKey } from '@/domain/billing/account-code.js';
import { appendCnpjCheckDigits } from '@/domain/companies/cnpj.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

let sequence = 0;

/** CNPJ válido e único dentro do arquivo de teste. */
export function nextCnpj(): string {
    sequence += 1;
    return appendCnpjCheckDigits(`${String(sequence).padStart(8, '0')}0001`);
}

export function addressFixture() {
    return {
        zipCode: '01310100',
        street: 'Av. Paulista',
        number: '1000',
        complement: null,
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
    };
}

export interface CompanyFixtureOverrides {
    id?: string;
    name?: string;
    cnpj?: string;
    isActive?: boolean;
}

export function companyFixtureData(overrides: CompanyFixtureOverrides = {}) {
    return {
        id: overrides.id ?? randomUUID(),
        name: overrides.name ?? 'Empresa Teste',
        socialReason: 'Empresa Teste LTDA',
        cnpj: overrides.cnpj ?? nextCnpj(),
        openingDate: new Date('2020-01-01T00:00:00.000Z'),
        cnae: '4711-3/01',
        taxRegime: 'Simples Nacional',
        email: 'contato@empresa.test',
        phone: '11999990000',
        isActive: overrides.isActive ?? true,
    };
}

/** Cria uma empresa com endereço direto no banco. */
export function createCompanyFixture(db: PrismaService, overrides: CompanyFixtureOverrides = {}) {
    return db.company.create({
        data: { ...companyFixtureData(overrides), address: { create: addressFixture() } },
    });
}

export function createPlanFixture(
    db: PrismaService,
    companyId: string,
    overrides: { id?: string; name?: string } = {},
) {
    return db.billingPlan.create({
        data: {
            id: overrides.id ?? randomUUID(),
            companyId,
            name: overrides.name ?? 'Plano Teste',
            description: '',
        },
    });
}

export function createAccountFixture(
    db: PrismaService,
    params: {
        billingPlanId: string;
        code: string;
        level: number;
        parentId?: string | null;
        id?: string;
        name?: string;
        accountType?: 'ANALYTIC' | 'SYNTHETIC';
        nature?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
        dreCategory?:
            | 'GROSS_REVENUE'
            | 'FINANCIAL_REVENUE'
            | 'OTHER_REVENUE'
            | 'REVENUE_DEDUCTION'
            | 'COST_OF_SALES'
            | 'OPERATING_EXPENSE'
            | 'FINANCIAL_EXPENSE'
            | 'OTHER_EXPENSE'
            | 'INCOME_TAX';
        balanceCategory?:
            | 'CURRENT_ASSET'
            | 'NON_CURRENT_ASSET'
            | 'CURRENT_LIABILITY'
            | 'NON_CURRENT_LIABILITY'
            | 'EQUITY';
    },
) {
    return db.billingAccount.create({
        data: {
            id: params.id ?? randomUUID(),
            billingPlanId: params.billingPlanId,
            parentId: params.parentId ?? null,
            name: params.name ?? `Conta ${params.code}`,
            accountType: params.accountType ?? 'SYNTHETIC',
            nature: params.nature ?? 'ASSET',
            dreCategory: params.dreCategory ?? null,
            balanceCategory: params.balanceCategory ?? null,
            code: params.code,
            sortKey: toSortKey(params.code),
            level: params.level,
        },
    });
}
