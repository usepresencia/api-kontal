import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

const { Pool } = pg;

const BASE_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const FULL_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function cnpjCheckDigit(digits, weights) {
    const sum = weights.reduce((acc, weight, index) => acc + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
}

function makeCnpj(base8, branch4 = '0001') {
    const base12 = `${String(base8).padStart(8, '0')}${branch4}`;
    const withFirst = `${base12}${cnpjCheckDigit(base12, BASE_WEIGHTS)}`;
    return `${withFirst}${cnpjCheckDigit(withFirst, FULL_WEIGHTS)}`;
}

function cpfCheckDigit(digits, weightStart) {
    const sum = digits.reduce((total, digit, index) => total + digit * (weightStart - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
}

function makeCpf(base9) {
    const str = String(base9).padStart(9, '0');
    const digits = [...str].map(Number);
    const d1 = cpfCheckDigit(digits, 10);
    const d2 = cpfCheckDigit([...digits, d1], 11);
    return `${str}${d1}${d2}`;
}

function toSortKey(code) {
    return code
        .split('.')
        .map(segment => segment.padStart(9, '0'))
        .join('.');
}

function d(isoDate) {
    return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Recusa rodar fora de um banco local: o seed apaga todos os dados das empresas. */
function assertLocalDatabase() {
    const url = process.env.DATABASE_URL ?? '';
    const host = (() => {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    })();
    const local = ['localhost', '127.0.0.1', '::1', 'db', 'postgres'].includes(host);
    if (process.env.NODE_ENV === 'production' || (!local && process.env.SEED_FORCE !== 'sim')) {
        console.error(
            `Seed recusado: o banco (${host || 'desconhecido'}) não é local. ` +
                'Ele apaga todos os dados; para um banco remoto de desenvolvimento use SEED_FORCE=sim.',
        );
        process.exit(1);
    }
}

async function main() {
    assertLocalDatabase();
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    try {
        console.log('1. Lendo usuários e empresas atuais para preservar sessão...');
        const existingUsers = await prisma.user.findMany();
        const existingCompanies = await prisma.company.findMany({
            orderBy: { createdAt: 'asc' },
        });
        const primaryCompanyId = existingCompanies[0]?.id ?? randomUUID();

        console.log('2. Limpando dados anteriores (seeds e movimentações)...');
        await prisma.$transaction([
            prisma.periodClosing.deleteMany(),
            prisma.journalLine.deleteMany(),
            prisma.journalEntry.deleteMany(),
            prisma.entry.deleteMany(),
            prisma.title.deleteMany(),
            prisma.titleSeries.deleteMany(),
            prisma.party.deleteMany(),
            prisma.presetAccount.deleteMany(),
            prisma.preset.deleteMany(),
            prisma.billingAccount.deleteMany(),
            prisma.billingPlan.deleteMany(),
            prisma.membership.deleteMany(),
            prisma.companyAddress.deleteMany(),
            prisma.company.deleteMany(),
        ]);

        console.log('3. Criando empresas (empresa principal + empresas da plataforma)...');
        const mainCompany = await prisma.company.create({
            data: {
                id: primaryCompanyId,
                name: 'Kontal Tecnologia & Gestão',
                socialReason: 'Kontal Soluções em Tecnologia e Contabilidade LTDA',
                cnpj: makeCnpj('12345678'),
                openingDate: d('2021-03-15'),
                cnae: '6202-3/00',
                taxRegime: 'Simples Nacional',
                email: 'financeiro@kontal.com.br',
                phone: '11988887777',
                isActive: true,
                closedThrough: d('2026-08-31'),
                address: {
                    create: {
                        zipCode: '01310100',
                        street: 'Avenida Paulista',
                        number: '1578',
                        complement: 'Conjunto 1204',
                        neighborhood: 'Bela Vista',
                        city: 'São Paulo',
                        state: 'SP',
                    },
                },
            },
        });

        const secondCompany = await prisma.company.create({
            data: {
                id: randomUUID(),
                name: 'Horizonte Comércio Digital',
                socialReason: 'Horizonte Comércio Varejista de Equipamentos LTDA',
                cnpj: makeCnpj('23456789'),
                openingDate: d('2022-07-01'),
                cnae: '4751-2/01',
                taxRegime: 'Simples Nacional',
                email: 'contato@horizontedigital.com.br',
                phone: '11977776666',
                isActive: true,
                address: {
                    create: {
                        zipCode: '04538132',
                        street: 'Avenida Brigadeiro Faria Lima',
                        number: '3477',
                        complement: 'Andar 8',
                        neighborhood: 'Itaim Bibi',
                        city: 'São Paulo',
                        state: 'SP',
                    },
                },
            },
        });

        await prisma.company.create({
            data: {
                id: randomUUID(),
                name: 'Vértice Consultoria Empresarial (Inativa)',
                socialReason: 'Vértice Consultoria em Gestão Empresarial S/S',
                cnpj: makeCnpj('34567890'),
                openingDate: d('2019-01-10'),
                cnae: '7020-4/00',
                taxRegime: 'Lucro Presumido',
                email: 'adm@verticeconsultoria.com.br',
                phone: '21966665555',
                isActive: false,
                address: {
                    create: {
                        zipCode: '20040002',
                        street: 'Avenida Rio Branco',
                        number: '115',
                        complement: 'Sala 402',
                        neighborhood: 'Centro',
                        city: 'Rio de Janeiro',
                        state: 'RJ',
                    },
                },
            },
        });

        for (const user of existingUsers) {
            await prisma.membership.create({
                data: {
                    companyId: mainCompany.id,
                    userId: user.id,
                    role: 'OWNER',
                    isActive: true,
                },
            });
            await prisma.membership.create({
                data: {
                    companyId: secondCompany.id,
                    userId: user.id,
                    role: 'OWNER',
                    isActive: true,
                },
            });
        }

        console.log('4. Criando Plano de Contas Completo (4 níveis hierárquicos)...');
        const mainPlan = await prisma.billingPlan.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                name: 'Plano de Contas Padrão PME (CPC 26)',
                description:
                    'Estrutura contábil e gerencial completa para empresas de serviços e comércio no Simples Nacional',
            },
        });

        await prisma.billingPlan.create({
            data: {
                id: randomUUID(),
                companyId: secondCompany.id,
                name: 'Plano Simplificado Horizonte Digital',
                description: 'Plano contábil padrão da segunda empresa da plataforma',
            },
        });

        const accountDefinitions = [
            // 1. ATIVO
            { code: '1', name: 'ATIVO', type: 'SYNTHETIC', nature: 'ASSET' },
            { code: '1.1', parent: '1', name: 'Ativo Circulante', type: 'SYNTHETIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.1', parent: '1.1', name: 'Caixa e Equivalentes de Caixa', type: 'SYNTHETIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.1.001', parent: '1.1.1', name: 'Caixa Geral (Fundo Fixo)', type: 'ANALYTIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.1.002', parent: '1.1.1', name: 'Banco Itaú Conta Movimento', type: 'ANALYTIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.1.003', parent: '1.1.1', name: 'Banco Cora Conta Digital PIX', type: 'ANALYTIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.1.004', parent: '1.1.1', name: 'Aplicações de Liquidez Imediata (CDB)', type: 'ANALYTIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.2', parent: '1.1', name: 'Clientes e Contas a Receber', type: 'SYNTHETIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.2.001', parent: '1.1.2', name: 'Clientes Serviços e Mensalidades a Receber', type: 'ANALYTIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.2.002', parent: '1.1.2', name: 'Clientes Vendas de Mercadorias a Receber', type: 'ANALYTIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.3', parent: '1.1', name: 'Estoques e Adiantamentos', type: 'SYNTHETIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.1.3.001', parent: '1.1.3', name: 'Estoque de Mercadorias para Revenda', type: 'ANALYTIC', nature: 'ASSET', balance: 'CURRENT_ASSET' },
            { code: '1.2', parent: '1', name: 'Ativo Não Circulante', type: 'SYNTHETIC', nature: 'ASSET', balance: 'NON_CURRENT_ASSET' },
            { code: '1.2.1', parent: '1.2', name: 'Imobilizado Operacional', type: 'SYNTHETIC', nature: 'ASSET', balance: 'NON_CURRENT_ASSET' },
            { code: '1.2.1.001', parent: '1.2.1', name: 'Equipamentos de Informática e Servidores', type: 'ANALYTIC', nature: 'ASSET', balance: 'NON_CURRENT_ASSET' },
            { code: '1.2.1.002', parent: '1.2.1', name: 'Móveis, Utensílios e Instalações', type: 'ANALYTIC', nature: 'ASSET', balance: 'NON_CURRENT_ASSET' },

            // 2. PASSIVO
            { code: '2', name: 'PASSIVO', type: 'SYNTHETIC', nature: 'LIABILITY' },
            { code: '2.1', parent: '2', name: 'Passivo Circulante', type: 'SYNTHETIC', nature: 'LIABILITY', balance: 'CURRENT_LIABILITY' },
            { code: '2.1.1', parent: '2.1', name: 'Fornecedores e Contas Operacionais a Pagar', type: 'SYNTHETIC', nature: 'LIABILITY', balance: 'CURRENT_LIABILITY' },
            { code: '2.1.1.001', parent: '2.1.1', name: 'Fornecedores de Tecnologia e Serviços a Pagar', type: 'ANALYTIC', nature: 'LIABILITY', balance: 'CURRENT_LIABILITY' },
            { code: '2.1.1.002', parent: '2.1.1', name: 'Fornecedores de Mercadorias e Insumos a Pagar', type: 'ANALYTIC', nature: 'LIABILITY', balance: 'CURRENT_LIABILITY' },
            { code: '2.1.1.003', parent: '2.1.1', name: 'Contas de Ocupação e Utilidades a Pagar', type: 'ANALYTIC', nature: 'LIABILITY', balance: 'CURRENT_LIABILITY' },
            { code: '2.1.2', parent: '2.1', name: 'Obrigações Trabalhistas e Tributárias', type: 'SYNTHETIC', nature: 'LIABILITY', balance: 'CURRENT_LIABILITY' },
            { code: '2.1.2.001', parent: '2.1.2', name: 'Simples Nacional (DAS) a Recolher', type: 'ANALYTIC', nature: 'LIABILITY', balance: 'CURRENT_LIABILITY' },
            { code: '2.1.2.002', parent: '2.1.2', name: 'Salários, Pró-Labore e Encargos a Pagar', type: 'ANALYTIC', nature: 'LIABILITY', balance: 'CURRENT_LIABILITY' },
            { code: '2.2', parent: '2', name: 'Passivo Não Circulante', type: 'SYNTHETIC', nature: 'LIABILITY', balance: 'NON_CURRENT_LIABILITY' },
            { code: '2.2.1', parent: '2.2', name: 'Financiamentos de Longo Prazo', type: 'SYNTHETIC', nature: 'LIABILITY', balance: 'NON_CURRENT_LIABILITY' },
            { code: '2.2.1.001', parent: '2.2.1', name: 'Empréstimo Pronampe / Capital de Giro LP', type: 'ANALYTIC', nature: 'LIABILITY', balance: 'NON_CURRENT_LIABILITY' },

            // 3. PATRIMÔNIO LÍQUIDO
            { code: '3', name: 'PATRIMÔNIO LÍQUIDO', type: 'SYNTHETIC', nature: 'EQUITY', balance: 'EQUITY' },
            { code: '3.1', parent: '3', name: 'Capital Social e Reservas', type: 'SYNTHETIC', nature: 'EQUITY', balance: 'EQUITY' },
            { code: '3.1.1', parent: '3.1', name: 'Capital Social Integralizado', type: 'SYNTHETIC', nature: 'EQUITY', balance: 'EQUITY' },
            { code: '3.1.1.001', parent: '3.1.1', name: 'Capital Social Subscrito e Integralizado', type: 'ANALYTIC', nature: 'EQUITY', balance: 'EQUITY' },
            { code: '3.1.2', parent: '3.1', name: 'Resultados Acumulados e Implantação', type: 'SYNTHETIC', nature: 'EQUITY', balance: 'EQUITY' },
            { code: '3.1.2.001', parent: '3.1.2', name: 'Lucros ou Prejuízos Acumulados', type: 'ANALYTIC', nature: 'EQUITY', balance: 'EQUITY' },
            { code: '3.1.2.002', parent: '3.1.2', name: 'Contrapartida de Saldos Iniciais (Implantação)', type: 'ANALYTIC', nature: 'EQUITY', balance: 'EQUITY' },

            // 4. RECEITAS
            { code: '4', name: 'RECEITAS OPERACIONAIS E FINANCEIRAS', type: 'SYNTHETIC', nature: 'REVENUE' },
            { code: '4.1', parent: '4', name: 'Receita Bruta de Vendas e Serviços', type: 'SYNTHETIC', nature: 'REVENUE', dre: 'GROSS_REVENUE' },
            { code: '4.1.1', parent: '4.1', name: 'Prestação de Serviços e Assinaturas', type: 'SYNTHETIC', nature: 'REVENUE', dre: 'GROSS_REVENUE' },
            { code: '4.1.1.001', parent: '4.1.1', name: 'Receita de Assinaturas SaaS e Mensalidades', type: 'ANALYTIC', nature: 'REVENUE', dre: 'GROSS_REVENUE' },
            { code: '4.1.1.002', parent: '4.1.1', name: 'Receita de Consultoria e Implantação Técnica', type: 'ANALYTIC', nature: 'REVENUE', dre: 'GROSS_REVENUE' },
            { code: '4.1.2', parent: '4.1', name: 'Venda de Mercadorias e Produtos', type: 'SYNTHETIC', nature: 'REVENUE', dre: 'GROSS_REVENUE' },
            { code: '4.1.2.001', parent: '4.1.2', name: 'Receita de Venda de Equipamentos e Licenças', type: 'ANALYTIC', nature: 'REVENUE', dre: 'GROSS_REVENUE' },
            { code: '4.2', parent: '4', name: 'Receitas Financeiras e Recuperações', type: 'SYNTHETIC', nature: 'REVENUE', dre: 'FINANCIAL_REVENUE' },
            { code: '4.2.1', parent: '4.2', name: 'Receitas Financeiras', type: 'SYNTHETIC', nature: 'REVENUE', dre: 'FINANCIAL_REVENUE' },
            { code: '4.2.1.001', parent: '4.2.1', name: 'Juros e Multas Recebidos de Clientes', type: 'ANALYTIC', nature: 'REVENUE', dre: 'FINANCIAL_REVENUE' },
            { code: '4.2.1.002', parent: '4.2.1', name: 'Descontos Financeiros Obtidos de Fornecedores', type: 'ANALYTIC', nature: 'REVENUE', dre: 'FINANCIAL_REVENUE' },
            { code: '4.2.1.003', parent: '4.2.1', name: 'Rendimentos de Aplicações Financeiras (CDB)', type: 'ANALYTIC', nature: 'REVENUE', dre: 'FINANCIAL_REVENUE' },
            { code: '4.2.2', parent: '4.2', name: 'Outras Receitas Operacionais', type: 'SYNTHETIC', nature: 'REVENUE', dre: 'OTHER_REVENUE' },
            { code: '4.2.2.001', parent: '4.2.2', name: 'Perdão de Dívidas e Recuperação de Despesas', type: 'ANALYTIC', nature: 'REVENUE', dre: 'OTHER_REVENUE' },

            // 5. CUSTOS E DESPESAS
            { code: '5', name: 'CUSTOS E DESPESAS', type: 'SYNTHETIC', nature: 'EXPENSE' },
            { code: '5.1', parent: '5', name: 'Deduções da Receita Bruta', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'REVENUE_DEDUCTION', cost: 'VARIABLE' },
            { code: '5.1.1', parent: '5.1', name: 'Tributos sobre Faturamento', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'REVENUE_DEDUCTION', cost: 'VARIABLE' },
            { code: '5.1.1.001', parent: '5.1.1', name: 'Simples Nacional sobre Vendas e Serviços (DAS)', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'REVENUE_DEDUCTION', cost: 'VARIABLE' },
            { code: '5.2', parent: '5', name: 'Custos dos Serviços e Mercadorias (CSP/CMV)', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'COST_OF_SALES', cost: 'VARIABLE' },
            { code: '5.2.1', parent: '5.2', name: 'Custos Diretos de Tecnologia e Mercadorias', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'COST_OF_SALES', cost: 'VARIABLE' },
            { code: '5.2.1.001', parent: '5.2.1', name: 'Servidores Cloud, Hospedagem e APIs de Terceiros', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'COST_OF_SALES', cost: 'VARIABLE' },
            { code: '5.2.1.002', parent: '5.2.1', name: 'Custo das Mercadorias e Equipamentos Vendidos', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'COST_OF_SALES', cost: 'VARIABLE' },
            { code: '5.3', parent: '5', name: 'Despesas Operacionais e Administrativas', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'OPERATING_EXPENSE', cost: 'FIXED' },
            { code: '5.3.1', parent: '5.3', name: 'Despesas com Pessoal e Encargos', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'OPERATING_EXPENSE', cost: 'FIXED' },
            { code: '5.3.1.001', parent: '5.3.1', name: 'Salários, Pró-Labore e Benefícios', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'OPERATING_EXPENSE', cost: 'FIXED' },
            { code: '5.3.2', parent: '5.3', name: 'Despesas Administrativas e Ocupação', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'OPERATING_EXPENSE', cost: 'FIXED' },
            { code: '5.3.2.001', parent: '5.3.2', name: 'Aluguel, Condomínio, Energia e Internet', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'OPERATING_EXPENSE', cost: 'FIXED' },
            { code: '5.3.2.002', parent: '5.3.2', name: 'Honorários Contábeis, Jurídicos e Softwares', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'OPERATING_EXPENSE', cost: 'FIXED' },
            { code: '5.3.2.003', parent: '5.3.2', name: 'Perdas com Créditos Incobráveis (Inadimplência)', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'OPERATING_EXPENSE', cost: 'VARIABLE' },
            { code: '5.3.3', parent: '5.3', name: 'Depreciação e Amortização', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'OPERATING_EXPENSE', cost: 'DEPRECIATION' },
            { code: '5.3.3.001', parent: '5.3.3', name: 'Quota de Depreciação de Equipamentos e Móveis', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'OPERATING_EXPENSE', cost: 'DEPRECIATION' },
            { code: '5.4', parent: '5', name: 'Despesas Financeiras', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'FINANCIAL_EXPENSE', cost: 'FIXED' },
            { code: '5.4.1', parent: '5.4', name: 'Juros, Tarifas e Descontos Concedidos', type: 'SYNTHETIC', nature: 'EXPENSE', dre: 'FINANCIAL_EXPENSE', cost: 'FIXED' },
            { code: '5.4.1.001', parent: '5.4.1', name: 'Juros e Multas Pagos a Fornecedores', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'FINANCIAL_EXPENSE', cost: 'FIXED' },
            { code: '5.4.1.002', parent: '5.4.1', name: 'Descontos Financeiros Concedidos a Clientes', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'FINANCIAL_EXPENSE', cost: 'VARIABLE' },
            { code: '5.4.1.003', parent: '5.4.1', name: 'Tarifas Bancárias e Taxas de PIX/Boleto', type: 'ANALYTIC', nature: 'EXPENSE', dre: 'FINANCIAL_EXPENSE', cost: 'FIXED' },
        ];

        const accByCode = new Map();
        for (const def of accountDefinitions) {
            const parentId = def.parent ? accByCode.get(def.parent).id : null;
            const level = def.code.split('.').length;
            const created = await prisma.billingAccount.create({
                data: {
                    id: randomUUID(),
                    billingPlanId: mainPlan.id,
                    parentId,
                    name: def.name,
                    accountType: def.type,
                    nature: def.nature,
                    dreCategory: def.dre ?? null,
                    balanceCategory: def.balance ?? null,
                    costBehavior: def.cost ?? null,
                    isActive: true,
                    code: def.code,
                    sortKey: toSortKey(def.code),
                    level,
                },
            });
            accByCode.set(def.code, created);
        }

        const accId = code => accByCode.get(code).id;

        console.log('5. Criando Presets contábeis...');
        const presetSaaS = await prisma.preset.create({
            data: {
                id: randomUUID(),
                billingPlanId: mainPlan.id,
                name: 'Mensalidades SaaS & Custos Cloud',
                description: 'Contabilização padrão de assinaturas recorrentes e infraestrutura de nuvem',
                isActive: true,
                accounts: {
                    create: [
                        { role: 'receivable', accountId: accId('1.1.2.001') },
                        { role: 'payable', accountId: accId('2.1.1.001') },
                        { role: 'revenue', accountId: accId('4.1.1.001') },
                        { role: 'expense', accountId: accId('5.2.1.001') },
                        { role: 'interestIncome', accountId: accId('4.2.1.001') },
                        { role: 'discountGranted', accountId: accId('5.4.1.002') },
                        { role: 'badDebt', accountId: accId('5.3.2.003') },
                        { role: 'interestExpense', accountId: accId('5.4.1.001') },
                        { role: 'discountObtained', accountId: accId('4.2.1.002') },
                        { role: 'debtForgiveness', accountId: accId('4.2.2.001') },
                        { role: 'openingBalance', accountId: accId('3.1.2.002') },
                    ],
                },
            },
        });

        const presetConsultoria = await prisma.preset.create({
            data: {
                id: randomUUID(),
                billingPlanId: mainPlan.id,
                name: 'Consultoria & Despesas Administrativas',
                description: 'Projetos de consultoria técnica, aluguel, contabilidade e despesas fixas',
                isActive: true,
                accounts: {
                    create: [
                        { role: 'receivable', accountId: accId('1.1.2.001') },
                        { role: 'payable', accountId: accId('2.1.1.003') },
                        { role: 'revenue', accountId: accId('4.1.1.002') },
                        { role: 'expense', accountId: accId('5.3.2.001') },
                        { role: 'interestIncome', accountId: accId('4.2.1.001') },
                        { role: 'discountGranted', accountId: accId('5.4.1.002') },
                        { role: 'badDebt', accountId: accId('5.3.2.003') },
                        { role: 'interestExpense', accountId: accId('5.4.1.001') },
                        { role: 'discountObtained', accountId: accId('4.2.1.002') },
                        { role: 'debtForgiveness', accountId: accId('4.2.2.001') },
                        { role: 'openingBalance', accountId: accId('3.1.2.002') },
                    ],
                },
            },
        });

        const presetComercio = await prisma.preset.create({
            data: {
                id: randomUUID(),
                billingPlanId: mainPlan.id,
                name: 'Venda de Equipamentos & Fornecedores',
                description: 'Comercialização de hardware, licenças e compra de mercadorias',
                isActive: true,
                accounts: {
                    create: [
                        { role: 'receivable', accountId: accId('1.1.2.002') },
                        { role: 'payable', accountId: accId('2.1.1.002') },
                        { role: 'revenue', accountId: accId('4.1.2.001') },
                        { role: 'expense', accountId: accId('5.2.1.002') },
                        { role: 'interestIncome', accountId: accId('4.2.1.001') },
                        { role: 'discountGranted', accountId: accId('5.4.1.002') },
                        { role: 'badDebt', accountId: accId('5.3.2.003') },
                        { role: 'interestExpense', accountId: accId('5.4.1.001') },
                        { role: 'discountObtained', accountId: accId('4.2.1.002') },
                        { role: 'debtForgiveness', accountId: accId('4.2.2.001') },
                        { role: 'openingBalance', accountId: accId('3.1.2.002') },
                    ],
                },
            },
        });

        console.log('6. Criando Clientes e Fornecedores (Parties)...');
        const clientAtlas = await prisma.party.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                kind: 'CLIENT',
                name: 'Grupo Atlas Engenharia',
                socialReason: 'Atlas Engenharia e Construções S.A.',
                document: makeCnpj('45678901'),
                email: 'contasapagar@atlasengenharia.com.br',
                phone: '1132224455',
                zipCode: '04578000',
                street: 'Avenida Engenheiro Luís Carlos Berrini',
                number: '105',
                complement: '14º Andar',
                neighborhood: 'Cidade Monções',
                city: 'São Paulo',
                state: 'SP',
                isActive: true,
                defaultPresetId: presetSaaS.id,
            },
        });

        const clientBianca = await prisma.party.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                kind: 'CLIENT',
                name: 'Clínica Dra. Bianca Monteiro',
                socialReason: 'Bianca Monteiro Serviços Médicos',
                document: makeCpf('384920174'),
                email: 'bianca@clinicamonteiro.med.br',
                phone: '11991112233',
                zipCode: '01414001',
                street: 'Rua Haddock Lobo',
                number: '595',
                complement: 'Sala 82',
                neighborhood: 'Cerqueira César',
                city: 'São Paulo',
                state: 'SP',
                isActive: true,
                defaultPresetId: presetConsultoria.id,
            },
        });

        const supplierCloud = await prisma.party.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                kind: 'SUPPLIER',
                name: 'Amazon AWS Cloud Brasil',
                socialReason: 'Amazon AWS Serviços Brasil LTDA',
                document: makeCnpj('56789012'),
                email: 'billing-br@amazon.com',
                phone: '1130031234',
                zipCode: '04543011',
                street: 'Avenida Presidente Juscelino Kubitschek',
                number: '2041',
                complement: 'Torre E',
                neighborhood: 'Vila Olímpia',
                city: 'São Paulo',
                state: 'SP',
                isActive: true,
                defaultPresetId: presetSaaS.id,
            },
        });

        const supplierImobiliaria = await prisma.party.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                kind: 'SUPPLIER',
                name: 'Paulista Corporate Imóveis',
                socialReason: 'Administradora Paulista de Bens Imóveis LTDA',
                document: makeCnpj('67890123'),
                email: 'locacao@paulistacorporate.com.br',
                phone: '1131119000',
                zipCode: '01310200',
                street: 'Avenida Paulista',
                number: '1842',
                complement: 'Conjunto 45',
                neighborhood: 'Bela Vista',
                city: 'São Paulo',
                state: 'SP',
                isActive: true,
                defaultPresetId: presetConsultoria.id,
            },
        });

        const bothTech = await prisma.party.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                kind: 'BOTH',
                name: 'Nexa Soluções & Hardware',
                socialReason: 'Nexa Distribuidora de Tecnologia LTDA',
                document: makeCnpj('78901234'),
                email: 'comercial@nexatech.com.br',
                phone: '1140048899',
                zipCode: '05425070',
                street: 'Rua Paes Leme',
                number: '215',
                complement: null,
                neighborhood: 'Pinheiros',
                city: 'São Paulo',
                state: 'SP',
                isActive: true,
                defaultPresetId: presetComercio.id,
            },
        });

        await prisma.party.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                kind: 'CLIENT',
                name: 'Antiga Papelaria Central (Inativo)',
                socialReason: 'Papelaria Central Paulistana LTDA',
                document: makeCnpj('89012345'),
                email: 'contato@papelariacentral.com.br',
                phone: '1122223333',
                isActive: false,
                defaultPresetId: presetComercio.id,
            },
        });

        // Helper para criar lançamentos contábeis perfeitamente balanceados
        async function postJournal({ date, description, referenceType, referenceId, lines }) {
            const totalDebits = lines.reduce((sum, l) => sum + Number(l.debit), 0).toFixed(2);
            const totalCredits = lines.reduce((sum, l) => sum + Number(l.credit), 0).toFixed(2);
            if (totalDebits !== totalCredits) {
                throw new Error(`Desbalanceado: ${description} (${totalDebits} != ${totalCredits})`);
            }
            const id = referenceType === 'MANUAL' ? referenceId : randomUUID();
            return prisma.journalEntry.create({
                data: {
                    id,
                    companyId: mainCompany.id,
                    date: d(date),
                    description,
                    referenceType,
                    referenceId,
                    totalDebits,
                    totalCredits,
                    lines: {
                        create: lines.map(l => ({
                            accountId: l.accountId,
                            debit: l.debit,
                            credit: l.credit,
                            memo: l.memo ?? description,
                        })),
                    },
                },
            });
        }

        // Helper para criar título + lançamento de criação (e baixa opcional)
        async function createTitleWithLedger({
            presetId,
            partyId,
            controlAccountId,
            resultAccountId,
            seriesId = null,
            seriesIndex = null,
            type,
            description,
            amount,
            issueDate,
            expirationDate,
            feesPercentageMonthly = '1.00',
            payment = null,
            writeOff = null,
        }) {
            const titleId = randomUUID();
            const status = payment ? 'SETTLED' : writeOff ? 'WRITTEN_OFF' : 'OPEN';
            const settledAmount = payment || writeOff ? amount : '0.00';

            const title = await prisma.title.create({
                data: {
                    id: titleId,
                    companyId: mainCompany.id,
                    presetId,
                    partyId,
                    controlAccountId,
                    resultAccountId,
                    seriesId,
                    seriesIndex,
                    type,
                    status,
                    description,
                    amount,
                    settledAmount,
                    issueDate: d(issueDate),
                    expirationDate: d(expirationDate),
                    feesPercentageMonthly,
                },
            });

            const creationLines =
                type === 'INCOME'
                    ? [
                          { accountId: controlAccountId, debit: amount, credit: '0.00', memo: description },
                          { accountId: resultAccountId, debit: '0.00', credit: amount, memo: description },
                      ]
                    : [
                          { accountId: resultAccountId, debit: amount, credit: '0.00', memo: description },
                          { accountId: controlAccountId, debit: '0.00', credit: amount, memo: description },
                      ];

            await postJournal({
                date: issueDate,
                description: `Título: ${description} - criação`,
                referenceType: 'TITLE_CREATION',
                referenceId: title.id,
                lines: creationLines,
            });

            if (payment) {
                const entryId = randomUUID();
                const principal = Number(amount);
                const interest = Number(payment.interestAmount ?? '0.00');
                const fine = Number(payment.fineAmount ?? '0.00');
                const discount = Number(payment.discountAmount ?? '0.00');
                const total = (principal + interest + fine - discount).toFixed(2);

                await prisma.entry.create({
                    data: {
                        id: entryId,
                        titleId: title.id,
                        kind: 'PAYMENT',
                        billingAccountId: payment.bankAccountId,
                        principalAmount: principal.toFixed(2),
                        interestAmount: interest.toFixed(2),
                        fineAmount: fine.toFixed(2),
                        discountAmount: discount.toFixed(2),
                        totalAmount: total,
                        paidAt: d(payment.paidAt),
                        paymentMethod: payment.paymentMethod ?? 'PIX',
                        description: payment.description ?? `Baixa: ${description}`,
                    },
                });

                const settlementLines = [];
                if (type === 'INCOME') {
                    settlementLines.push({
                        accountId: payment.bankAccountId,
                        debit: total,
                        credit: '0.00',
                        memo: description,
                    });
                    if (discount > 0) {
                        settlementLines.push({
                            accountId: accId('5.4.1.002'),
                            debit: discount.toFixed(2),
                            credit: '0.00',
                            memo: description,
                        });
                    }
                    settlementLines.push({
                        accountId: controlAccountId,
                        debit: '0.00',
                        credit: principal.toFixed(2),
                        memo: description,
                    });
                    if (interest + fine > 0) {
                        settlementLines.push({
                            accountId: accId('4.2.1.001'),
                            debit: '0.00',
                            credit: (interest + fine).toFixed(2),
                            memo: description,
                        });
                    }
                } else {
                    settlementLines.push({
                        accountId: controlAccountId,
                        debit: principal.toFixed(2),
                        credit: '0.00',
                        memo: description,
                    });
                    if (interest + fine > 0) {
                        settlementLines.push({
                            accountId: accId('5.4.1.001'),
                            debit: (interest + fine).toFixed(2),
                            credit: '0.00',
                            memo: description,
                        });
                    }
                    settlementLines.push({
                        accountId: payment.bankAccountId,
                        debit: '0.00',
                        credit: total,
                        memo: description,
                    });
                    if (discount > 0) {
                        settlementLines.push({
                            accountId: accId('4.2.1.002'),
                            debit: '0.00',
                            credit: discount.toFixed(2),
                            memo: description,
                        });
                    }
                }

                await postJournal({
                    date: payment.paidAt,
                    description: `Baixa: ${description}`,
                    referenceType: 'SETTLEMENT',
                    referenceId: entryId,
                    lines: settlementLines,
                });
            }

            if (writeOff) {
                const entryId = randomUUID();
                await prisma.entry.create({
                    data: {
                        id: entryId,
                        titleId: title.id,
                        kind: 'WRITE_OFF',
                        billingAccountId: null,
                        principalAmount: amount,
                        interestAmount: '0.00',
                        fineAmount: '0.00',
                        discountAmount: '0.00',
                        totalAmount: amount,
                        paidAt: d(writeOff.paidAt),
                        paymentMethod: null,
                        description: writeOff.description ?? `Baixa por perda: ${description}`,
                    },
                });

                const writeOffLines =
                    type === 'INCOME'
                        ? [
                              { accountId: accId('5.3.2.003'), debit: amount, credit: '0.00', memo: description },
                              { accountId: controlAccountId, debit: '0.00', credit: amount, memo: description },
                          ]
                        : [
                              { accountId: controlAccountId, debit: amount, credit: '0.00', memo: description },
                              { accountId: accId('4.2.2.001'), debit: '0.00', credit: amount, memo: description },
                          ];

                await postJournal({
                    date: writeOff.paidAt,
                    description: `Perda: ${description}`,
                    referenceType: 'SETTLEMENT',
                    referenceId: entryId,
                    lines: writeOffLines,
                });
            }

            return title;
        }

        console.log('7. Lançando movimentações manuais e fechamento de agosto/2026...');
        const manual1Id = randomUUID();
        await postJournal({
            date: '2026-08-01',
            description: 'Integralização de Capital Social em Conta Corrente Itaú',
            referenceType: 'MANUAL',
            referenceId: manual1Id,
            lines: [
                { accountId: accId('1.1.1.002'), debit: '120000.00', credit: '0.00' },
                { accountId: accId('3.1.1.001'), debit: '0.00', credit: '120000.00' },
            ],
        });

        const manual2Id = randomUUID();
        await postJournal({
            date: '2026-08-05',
            description: 'Transferência para Aplicação CDB Liquidez Diária e Fundo Fixo de Caixa',
            referenceType: 'MANUAL',
            referenceId: manual2Id,
            lines: [
                { accountId: accId('1.1.1.004'), debit: '45000.00', credit: '0.00' },
                { accountId: accId('1.1.1.001'), debit: '2500.00', credit: '0.00' },
                { accountId: accId('1.1.1.002'), debit: '0.00', credit: '47500.00' },
            ],
        });

        const manual3Id = randomUUID();
        await postJournal({
            date: '2026-08-10',
            description: 'Aquisição de Servidores e Notebooks à vista no Itaú',
            referenceType: 'MANUAL',
            referenceId: manual3Id,
            lines: [
                { accountId: accId('1.2.1.001'), debit: '18000.00', credit: '0.00' },
                { accountId: accId('1.1.1.002'), debit: '0.00', credit: '18000.00' },
            ],
        });

        // Títulos de Agosto/2026
        await createTitleWithLedger({
            presetId: presetSaaS.id,
            partyId: clientAtlas.id,
            controlAccountId: accId('1.1.2.001'),
            resultAccountId: accId('4.1.1.001'),
            type: 'INCOME',
            description: 'Assinatura Enterprise Kontal ERP (Competência 08/2026)',
            amount: '14500.00',
            issueDate: '2026-08-05',
            expirationDate: '2026-08-15',
            payment: {
                bankAccountId: accId('1.1.1.002'),
                paidAt: '2026-08-15',
                paymentMethod: 'PIX',
            },
        });

        await createTitleWithLedger({
            presetId: presetConsultoria.id,
            partyId: supplierImobiliaria.id,
            controlAccountId: accId('2.1.1.003'),
            resultAccountId: accId('5.3.2.001'),
            type: 'EXPENSE',
            description: 'Aluguel e Condomínio Conjunto Paulista (08/2026)',
            amount: '4200.00',
            issueDate: '2026-08-05',
            expirationDate: '2026-08-20',
            payment: {
                bankAccountId: accId('1.1.1.002'),
                paidAt: '2026-08-20',
                paymentMethod: 'DEBIT',
            },
        });

        // Fechamento de Agosto/2026
        await prisma.periodClosing.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                throughDate: d('2026-08-31'),
            },
        });

        console.log('8. Lançando títulos, parcelamentos, recorrências e baixas em Setembro e Outubro/2026...');
        // Setembro e Outubro/2026: Lançamentos manuais
        const manual4Id = randomUUID();
        await postJournal({
            date: '2026-09-30',
            description: 'Reconhecimento de Rendimento Mensal CDB e Depreciação de Equipamentos',
            referenceType: 'MANUAL',
            referenceId: manual4Id,
            lines: [
                { accountId: accId('1.1.1.004'), debit: '485.50', credit: '0.00' },
                { accountId: accId('4.2.1.003'), debit: '0.00', credit: '485.50' },
            ],
        });

        const manual5Id = randomUUID();
        await postJournal({
            date: '2026-09-30',
            description: 'Provisão de Folha de Pagamento e Simples Nacional (09/2026)',
            referenceType: 'MANUAL',
            referenceId: manual5Id,
            lines: [
                { accountId: accId('5.3.1.001'), debit: '9800.00', credit: '0.00' },
                { accountId: accId('5.1.1.001'), debit: '1920.00', credit: '0.00' },
                { accountId: accId('2.1.2.002'), debit: '0.00', credit: '9800.00' },
                { accountId: accId('2.1.2.001'), debit: '0.00', credit: '1920.00' },
            ],
        });

        const manual6Id = randomUUID();
        await postJournal({
            date: '2026-10-05',
            description: 'Quota Mensal de Depreciação de Equipamentos de Informática',
            referenceType: 'MANUAL',
            referenceId: manual6Id,
            lines: [
                { accountId: accId('5.3.3.001'), debit: '300.00', credit: '0.00' },
                { accountId: accId('1.2.1.001'), debit: '0.00', credit: '300.00' },
            ],
        });

        // Série Parcelada (INSTALLMENT): Projeto de Implantação em 3x
        const installmentSeries = await prisma.titleSeries.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                kind: 'INSTALLMENT',
                frequency: 'MONTHLY',
                totalCount: 3,
                baseDescription: 'Projeto Implantação Contábil Clínica Dra. Bianca',
                firstIssueDate: d('2026-09-10'),
                firstExpirationDate: d('2026-09-25'),
            },
        });

        // Parcela 1/3 (Paga com juros)
        await createTitleWithLedger({
            presetId: presetConsultoria.id,
            partyId: clientBianca.id,
            controlAccountId: accId('1.1.2.001'),
            resultAccountId: accId('4.1.1.002'),
            seriesId: installmentSeries.id,
            seriesIndex: 1,
            type: 'INCOME',
            description: 'Projeto Implantação Contábil Clínica Dra. Bianca (1/3)',
            amount: '3200.00',
            issueDate: '2026-09-10',
            expirationDate: '2026-09-25',
            payment: {
                bankAccountId: accId('1.1.1.003'),
                paidAt: '2026-09-28',
                interestAmount: '45.00',
                fineAmount: '64.00',
                paymentMethod: 'PIX',
            },
        });

        // Parcela 2/3 (Em aberto no mês atual)
        await createTitleWithLedger({
            presetId: presetConsultoria.id,
            partyId: clientBianca.id,
            controlAccountId: accId('1.1.2.001'),
            resultAccountId: accId('4.1.1.002'),
            seriesId: installmentSeries.id,
            seriesIndex: 2,
            type: 'INCOME',
            description: 'Projeto Implantação Contábil Clínica Dra. Bianca (2/3)',
            amount: '3200.00',
            issueDate: '2026-09-10',
            expirationDate: '2026-10-25',
        });

        // Parcela 3/3 (Em aberto próximo mês)
        await createTitleWithLedger({
            presetId: presetConsultoria.id,
            partyId: clientBianca.id,
            controlAccountId: accId('1.1.2.001'),
            resultAccountId: accId('4.1.1.002'),
            seriesId: installmentSeries.id,
            seriesIndex: 3,
            type: 'INCOME',
            description: 'Projeto Implantação Contábil Clínica Dra. Bianca (3/3)',
            amount: '3200.00',
            issueDate: '2026-09-10',
            expirationDate: '2026-11-25',
        });

        // Série Recorrente (RECURRING): Infraestrutura AWS Mensal
        const recurringSeries = await prisma.titleSeries.create({
            data: {
                id: randomUUID(),
                companyId: mainCompany.id,
                kind: 'RECURRING',
                frequency: 'MONTHLY',
                totalCount: 3,
                baseDescription: 'Infraestrutura Cloud AWS Produção e Banco de Dados',
                firstIssueDate: d('2026-09-01'),
                firstExpirationDate: d('2026-09-15'),
            },
        });

        // Recorrência 1/3 (Paga com desconto obtido)
        await createTitleWithLedger({
            presetId: presetSaaS.id,
            partyId: supplierCloud.id,
            controlAccountId: accId('2.1.1.001'),
            resultAccountId: accId('5.2.1.001'),
            seriesId: recurringSeries.id,
            seriesIndex: 1,
            type: 'EXPENSE',
            description: 'Infraestrutura Cloud AWS Produção e Banco de Dados (1/3)',
            amount: '2450.00',
            issueDate: '2026-09-01',
            expirationDate: '2026-09-15',
            payment: {
                bankAccountId: accId('1.1.1.002'),
                paidAt: '2026-09-12',
                discountAmount: '150.00',
                paymentMethod: 'CREDIT',
            },
        });

        // Recorrência 2/3 (Paga em Outubro)
        await createTitleWithLedger({
            presetId: presetSaaS.id,
            partyId: supplierCloud.id,
            controlAccountId: accId('2.1.1.001'),
            resultAccountId: accId('5.2.1.001'),
            seriesId: recurringSeries.id,
            seriesIndex: 2,
            type: 'EXPENSE',
            description: 'Infraestrutura Cloud AWS Produção e Banco de Dados (2/3)',
            amount: '2450.00',
            issueDate: '2026-10-01',
            expirationDate: '2026-10-15',
            payment: {
                bankAccountId: accId('1.1.1.002'),
                paidAt: '2026-10-15',
                paymentMethod: 'PIX',
            },
        });

        // Recorrência 3/3 (Em aberto em Novembro)
        await createTitleWithLedger({
            presetId: presetSaaS.id,
            partyId: supplierCloud.id,
            controlAccountId: accId('2.1.1.001'),
            resultAccountId: accId('5.2.1.001'),
            seriesId: recurringSeries.id,
            seriesIndex: 3,
            type: 'EXPENSE',
            description: 'Infraestrutura Cloud AWS Produção e Banco de Dados (3/3)',
            amount: '2450.00',
            issueDate: '2026-11-01',
            expirationDate: '2026-11-15',
        });

        // Títulos avulsos adicionais em Setembro e Outubro/2026
        await createTitleWithLedger({
            presetId: presetSaaS.id,
            partyId: clientAtlas.id,
            controlAccountId: accId('1.1.2.001'),
            resultAccountId: accId('4.1.1.001'),
            type: 'INCOME',
            description: 'Assinatura Enterprise Kontal ERP (Competência 09/2026)',
            amount: '14500.00',
            issueDate: '2026-09-05',
            expirationDate: '2026-09-15',
            payment: {
                bankAccountId: accId('1.1.1.002'),
                paidAt: '2026-09-14',
                discountAmount: '250.00',
                paymentMethod: 'PIX',
            },
        });

        await createTitleWithLedger({
            presetId: presetSaaS.id,
            partyId: clientAtlas.id,
            controlAccountId: accId('1.1.2.001'),
            resultAccountId: accId('4.1.1.001'),
            type: 'INCOME',
            description: 'Assinatura Enterprise Kontal ERP (Competência 10/2026)',
            amount: '14500.00',
            issueDate: '2026-10-05',
            expirationDate: '2026-10-20',
        });

        await createTitleWithLedger({
            presetId: presetComercio.id,
            partyId: bothTech.id,
            controlAccountId: accId('1.1.2.002'),
            resultAccountId: accId('4.1.2.001'),
            type: 'INCOME',
            description: 'Fornecimento de Licenças e Terminais Nexa Tech',
            amount: '6800.00',
            issueDate: '2026-10-02',
            expirationDate: '2026-10-12',
            payment: {
                bankAccountId: accId('1.1.1.003'),
                paidAt: '2026-10-12',
                paymentMethod: 'PIX',
            },
        });

        await createTitleWithLedger({
            presetId: presetComercio.id,
            partyId: bothTech.id,
            controlAccountId: accId('1.1.2.002'),
            resultAccountId: accId('4.1.2.001'),
            type: 'INCOME',
            description: 'Taxa de Setup Adicional (Baixada por Inadimplência)',
            amount: '850.00',
            issueDate: '2026-09-02',
            expirationDate: '2026-09-12',
            writeOff: {
                paidAt: '2026-09-29',
            },
        });

        await createTitleWithLedger({
            presetId: presetConsultoria.id,
            partyId: supplierImobiliaria.id,
            controlAccountId: accId('2.1.1.003'),
            resultAccountId: accId('5.3.2.001'),
            type: 'EXPENSE',
            description: 'Aluguel e Condomínio Conjunto Paulista (10/2026)',
            amount: '4200.00',
            issueDate: '2026-10-05',
            expirationDate: '2026-10-22',
        });

        console.log('9. Conferindo integridade contábil do razão (Débitos === Créditos)...');
        const totals = await prisma.journalLine.aggregate({
            where: { journalEntry: { companyId: mainCompany.id } },
            _sum: { debit: true, credit: true },
        });
        const totalDebit = totals._sum.debit?.toFixed(2) ?? '0.00';
        const totalCredit = totals._sum.credit?.toFixed(2) ?? '0.00';
        if (totalDebit !== totalCredit) {
            throw new Error(`Razão desbalanceado: Débitos=${totalDebit} vs Créditos=${totalCredit}`);
        }

        console.log(`✅ Seed concluído com sucesso!`);
        console.log(`   - Empresa ativa: ${mainCompany.name} (${mainCompany.id})`);
        console.log(`   - Contas criadas no plano principal: ${accountDefinitions.length}`);
        console.log(`   - Total Débitos = Total Créditos = R$ ${totalDebit}`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main().catch(err => {
    console.error('Erro ao executar seed:', err);
    process.exit(1);
});
