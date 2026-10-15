import { randomUUID } from 'node:crypto';
import { formatMoney, parseMoney } from '@/domain/money.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';

/** Empresa e plano com Ativo (1: Banco 1.1, Clientes 1.2), Receitas (3: Vendas 3.1) e Despesas (4: Administrativas 4.1). */
export async function seedReportPlan(db: PrismaService, name = 'Empresa') {
    const company = await createCompanyFixture(db, { name });
    const plan = await createPlanFixture(db, company.id);
    const account = (code: string, nature: 'ASSET' | 'REVENUE' | 'EXPENSE', parentId?: string) =>
        createAccountFixture(db, {
            billingPlanId: plan.id,
            parentId,
            code,
            level: code.split('.').length,
            nature,
            name: `Conta ${code}`,
            accountType: parentId ? 'ANALYTIC' : 'SYNTHETIC',
        });
    const assetRoot = await account('1', 'ASSET');
    const revenueRoot = await account('3', 'REVENUE');
    const expenseRoot = await account('4', 'EXPENSE');
    const accounts = {
        assetRoot: assetRoot.id,
        bank: (await account('1.1', 'ASSET', assetRoot.id)).id,
        clients: (await account('1.2', 'ASSET', assetRoot.id)).id,
        revenueRoot: revenueRoot.id,
        sales: (await account('3.1', 'REVENUE', revenueRoot.id)).id,
        expenseRoot: expenseRoot.id,
        admin: (await account('4.1', 'EXPENSE', expenseRoot.id)).id,
    };
    return { company, plan, accounts };
}

/** Grava um lançamento direto no banco: linhas `[conta, débito, crédito]` em texto. */
export async function postJournal(
    db: PrismaService,
    companyId: string,
    date: string,
    lines: [string, string, string][],
    referenceType: 'TITLE_CREATION' | 'MANUAL' = 'TITLE_CREATION',
) {
    const total = formatMoney(lines.reduce((sum, [, debit]) => sum + parseMoney(debit), 0));
    const id = randomUUID();
    return db.journalEntry.create({
        data: {
            id,
            companyId,
            date: new Date(`${date}T00:00:00.000Z`),
            description: `Lançamento ${date}`,
            referenceType,
            referenceId: id,
            totalDebits: total,
            totalCredits: total,
            lines: {
                create: lines.map(([accountId, debit, credit]) => ({ accountId, debit, credit })),
            },
        },
    });
}
