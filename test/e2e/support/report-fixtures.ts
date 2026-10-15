import { expect } from 'vitest';
import type request from 'supertest';
import { bearer } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import type { IdentityKey } from '@test/e2e/support/firebase-emulator.js';
import { seedLedger, titleBody } from '@test/e2e/support/ledger-fixtures.js';
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

type Api = () => ReturnType<typeof request>;

/** Headers com o token da identidade e o tenant. */
export async function asTenant(key: IdentityKey, companyId: string) {
    return { ...(await bearer(key)), 'X-Tenant-Id': companyId };
}

/** `seedLedger` com o patrimônio líquido (5) e o capital social (5.1). */
export async function seedReportLedger(
    db: PrismaService,
    options: { companyId?: string; name?: string } = {},
) {
    const seed = await seedLedger(db, options);
    const equityRoot = await createAccountFixture(db, {
        billingPlanId: seed.plan.id,
        code: '5',
        level: 1,
        nature: 'EQUITY',
        name: 'Patrimônio líquido',
    });
    const capital = await createAccountFixture(db, {
        billingPlanId: seed.plan.id,
        parentId: equityRoot.id,
        code: '5.1',
        level: 2,
        nature: 'EQUITY',
        name: 'Capital social',
        accountType: 'ANALYTIC',
    });
    return {
        ...seed,
        accounts: { ...seed.accounts, equityRoot: equityRoot.id, capital: capital.id },
    };
}

export type ReportLedger = Awaited<ReturnType<typeof seedReportLedger>>;

/** Monta o cenário padrão dos relatórios pela API. */
export async function runReportScenario(
    api: Api,
    headers: Record<string, string>,
    seed: ReportLedger,
) {
    const a = seed.accounts;
    for (const [id, dreCategory] of [
        [a.revenue, 'GROSS_REVENUE'],
        [a.interestIncome, 'FINANCIAL_REVENUE'],
        [a.discountGranted, 'FINANCIAL_EXPENSE'],
        [a.badDebt, 'OPERATING_EXPENSE'],
    ]) {
        await api()
            .put(`/api/v1/billing-accounts/${id}`)
            .set(headers)
            .send({ dreCategory })
            .expect(200);
    }
    const manual = (
        await api()
            .post('/api/v1/journal-entries')
            .set(headers)
            .send({
                date: isoDay(-30),
                description: 'Aporte de capital',
                lines: [
                    { accountId: a.bank, debit: '5000.00' },
                    { accountId: a.capital, credit: '5000.00' },
                ],
            })
            .expect(201)
    ).body;
    const title = async (overrides: Record<string, unknown>) =>
        (
            await api()
                .post('/api/v1/titles')
                .set(headers)
                .send(titleBody(seed.preset.id, overrides))
                .expect(201)
        ).body;
    const pay = async (titleId: string, body: Record<string, unknown>) =>
        (
            await api()
                .post(`/api/v1/titles/${titleId}/entries`)
                .set(headers)
                .send({ billingAccountId: a.bank, paymentMethod: 'PIX', ...body })
                .expect(201)
        ).body;
    const titleA = await title({
        description: 'Venda A',
        amount: '1000.00',
        issueDate: isoDay(-10),
    });
    const titleB = await title({
        type: 'EXPENSE',
        description: 'Despesa B',
        amount: '300.00',
        issueDate: isoDay(-8),
    });
    const titleC = await title({ description: 'Venda C', amount: '200.00', issueDate: isoDay(-7) });
    const paymentA = await pay(titleA.id, {
        principalAmount: '600.00',
        interestAmount: '20.00',
        discountAmount: '5.00',
        paidAt: isoDay(-5),
    });
    const paymentB = await pay(titleB.id, { principalAmount: '300.00', paidAt: isoDay(-2) });
    await api().post(`/api/v1/titles/${titleC.id}/write-off`).set(headers).send({}).expect(201);
    return { manual, titleA, titleB, titleC, paymentA, paymentB };
}

interface Balance {
    amount: string;
    side: 'D' | 'C';
}

interface TreeNode {
    id: string;
    amount: string;
    children: TreeNode[];
}

const signed = (text: string) =>
    text.startsWith('-') ? -parseMoney(text.slice(1)) : parseMoney(text);
const raw = (balance: Balance) => (balance.side === 'D' ? 1 : -1) * parseMoney(balance.amount);
const flatten = (nodes: TreeNode[]): TreeNode[] =>
    nodes.flatMap(node => [node, ...flatten(node.children)]);

function dayBefore(iso: string): string {
    const date = new Date(`${iso}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

/**
 * Confere pelas rotas: balancete fechado, ativo = passivo + PL, DRE = variação do resultado
 * acumulado, razão = balancete = balanço por conta patrimonial e diário = débitos do balancete.
 */
export async function expectReportsReconciled(
    api: Api,
    headers: Record<string, string>,
    start: string,
    end: string,
): Promise<void> {
    const get = async (path: string) =>
        (await api().get(`/api/v1/reports/${path}`).set(headers).expect(200)).body;

    const trial = await get(`trial-balance?start=${start}&end=${end}`);
    expect(trial.totals.debits).toBe(trial.totals.credits);
    expect(trial.totals.openingDebitBalances).toBe(trial.totals.openingCreditBalances);
    expect(trial.totals.closingDebitBalances).toBe(trial.totals.closingCreditBalances);

    const sheet = await get(`balance-sheet?date=${end}`);
    expect(sheet.assets.total).toBe(sheet.liabilitiesAndEquity);

    const dre = await get(`dre?start=${start}&end=${end}`);
    const before = await get(`balance-sheet?date=${dayBefore(start)}`);
    expect(signed(dre.lines.netResult)).toBe(
        signed(sheet.equity.accumulatedResult) - signed(before.equity.accumulatedResult),
    );

    const groups = [
        sheet.assets.current,
        sheet.assets.nonCurrent,
        sheet.liabilities.current,
        sheet.liabilities.nonCurrent,
        sheet.equity.accounts,
    ];
    const sheetAmounts = new Map(
        groups.flatMap(group => flatten(group.tree)).map(node => [node.id, signed(node.amount)]),
    );
    const patrimonial = (
        trial.lines as {
            accountId: string;
            nature: string;
            accountType: string;
            closingBalance: Balance;
        }[]
    ).filter(
        line =>
            line.accountType === 'ANALYTIC' &&
            ['ASSET', 'LIABILITY', 'EQUITY'].includes(line.nature),
    );
    for (const line of patrimonial) {
        const ledger = await get(
            `account-ledger?accountId=${line.accountId}&start=${start}&end=${end}&groupBy=day`,
        );
        expect(ledger.closingBalance).toEqual(line.closingBalance);
        const natural =
            line.nature === 'ASSET' ? raw(line.closingBalance) : -raw(line.closingBalance);
        expect(sheetAmounts.get(line.accountId)).toBe(natural);
    }

    let debits = 0;
    for (let page = 1, total = 1; (page - 1) * 31 < total; page++) {
        const body = await get(`daily-journal?start=${start}&end=${end}&pageSize=31&page=${page}`);
        for (const day of body.items) debits += parseMoney(day.totalDebits);
        total = body.total;
    }
    expect(debits).toBe(parseMoney(trial.totals.debits));
}
