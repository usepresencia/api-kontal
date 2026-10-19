import { appendCnpjCheckDigits } from '@/domain/companies/cnpj.js';
import { expect } from 'vitest';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';
import { isoDay } from '@test/e2e/support/dates.js';

type Nature = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

const ROLE_ACCOUNTS = [
    ['bank', '1.1', 1, 'ASSET', 'Banco'],
    ['receivable', '1.2', 1, 'ASSET', 'Clientes a receber'],
    ['payable', '2.1', 2, 'LIABILITY', 'Fornecedores a pagar'],
    ['revenue', '3.1', 3, 'REVENUE', 'Receita de vendas'],
    ['interestIncome', '3.2', 3, 'REVENUE', 'Juros recebidos'],
    ['discountObtained', '3.3', 3, 'REVENUE', 'Descontos obtidos'],
    ['debtForgiveness', '3.4', 3, 'REVENUE', 'Perdão de dívida'],
    ['expense', '4.1', 4, 'EXPENSE', 'Despesas gerais'],
    ['discountGranted', '4.2', 4, 'EXPENSE', 'Descontos concedidos'],
    ['badDebt', '4.3', 4, 'EXPENSE', 'Perdas com clientes'],
    ['interestExpense', '4.4', 4, 'EXPENSE', 'Juros pagos'],
] as const;

const ROOTS: Record<number, [string, Nature, string]> = {
    1: ['1', 'ASSET', 'Ativo'],
    2: ['2', 'LIABILITY', 'Passivo'],
    3: ['3', 'REVENUE', 'Receitas'],
    4: ['4', 'EXPENSE', 'Despesas'],
};

export type RoleName = (typeof ROLE_ACCOUNTS)[number][0];

let partySequence = 0;

/** Contraparte (cliente e fornecedor) com CNPJ válido e único e o preset como padrão. */
export async function createPartyFixture(
    db: PrismaService,
    companyId: string,
    defaultPresetId: string | null,
    overrides: Record<string, unknown> = {},
) {
    partySequence += 1;
    const base = String(10_000_000 + partySequence).padStart(8, '0');
    return db.party.create({
        data: {
            companyId,
            kind: 'BOTH',
            name: `Parte ${partySequence}`,
            socialReason: `Parte ${partySequence} LTDA`,
            document: appendCnpjCheckDigits(`${base}0001`),
            defaultPresetId,
            ...overrides,
        },
    });
}

/** Empresa, plano, árvore de contas com naturezas, um preset completo e uma contraparte. */
export async function seedLedger(
    db: PrismaService,
    options: { companyId?: string; name?: string } = {},
) {
    const company = await createCompanyFixture(db, {
        id: options.companyId,
        name: options.name ?? 'Empresa',
    });
    const plan = await createPlanFixture(db, company.id);
    const roots = new Map<number, string>();
    for (const [key, [code, nature, name]] of Object.entries(ROOTS)) {
        const root = await createAccountFixture(db, {
            billingPlanId: plan.id,
            code,
            level: 1,
            nature,
            name,
        });
        roots.set(Number(key), root.id);
    }
    const accounts = {} as Record<RoleName, string>;
    for (const [role, code, rootKey, nature, name] of ROLE_ACCOUNTS) {
        const leaf = await createAccountFixture(db, {
            billingPlanId: plan.id,
            parentId: roots.get(rootKey),
            code,
            level: 2,
            nature,
            name,
            accountType: 'ANALYTIC',
        });
        accounts[role] = leaf.id;
    }
    const presetRoles = ROLE_ACCOUNTS.filter(([role]) => role !== 'bank').map(([role]) => role);
    const preset = await db.preset.create({
        data: {
            billingPlanId: plan.id,
            name: 'Preset completo',
            accounts: { create: presetRoles.map(role => ({ role, accountId: accounts[role] })) },
        },
    });
    const party = await createPartyFixture(db, company.id, preset.id);
    return { company, plan, accounts, preset, party };
}

/** Corpo válido de criação de título. */
export function titleBody(
    seed: { preset: { id: string }; party: { id: string } },
    overrides: Record<string, unknown> = {},
) {
    return {
        presetId: seed.preset.id,
        partyId: seed.party.id,
        type: 'INCOME',
        description: 'Venda',
        amount: '1000.00',
        issueDate: isoDay(-10),
        expirationDate: isoDay(20),
        ...overrides,
    };
}

export interface JournalLineView {
    accountId: string;
    debit: string;
    credit: string;
}

export const d = (accountId: string, amount: string): JournalLineView => ({
    accountId,
    debit: amount,
    credit: '0.00',
});
export const c = (accountId: string, amount: string): JournalLineView => ({
    accountId,
    debit: '0.00',
    credit: amount,
});

const byAccount = (a: JournalLineView, b: JournalLineView) =>
    `${a.accountId}${a.debit}${a.credit}`.localeCompare(`${b.accountId}${b.debit}${b.credit}`);

/** Lançamento (data, total e linhas ordenadas) de uma referência do razão. */
export async function journalOf(db: PrismaService, referenceType: string, referenceId: string) {
    const entry = await db.journalEntry.findFirstOrThrow({
        where: { referenceType: referenceType as never, referenceId },
        include: { lines: true },
    });
    return {
        date: entry.date.toISOString().slice(0, 10),
        total: entry.totalDebits.toFixed(2),
        lines: entry.lines
            .map(line => ({
                accountId: line.accountId,
                debit: line.debit.toFixed(2),
                credit: line.credit.toFixed(2),
            }))
            .sort(byAccount),
    };
}

export const sorted = (lines: JournalLineView[]) => [...lines].sort(byAccount);

const cents = (value: { toFixed(n: number): string } | null | undefined) =>
    Math.round(Number((value ?? { toFixed: () => '0' }).toFixed(2)) * 100);

/**
 * Confere que o razão fecha: débitos = créditos e o saldo de cada conta de controle é igual
 * à soma dos saldos em aberto dos títulos que a usam.
 */
export async function expectLedgerReconciled(db: PrismaService, companyId: string): Promise<void> {
    const totals = await db.journalLine.aggregate({
        where: { journalEntry: { companyId } },
        _sum: { debit: true, credit: true },
    });
    expect(cents(totals._sum.debit)).toBe(cents(totals._sum.credit));

    const titles = await db.title.findMany({ where: { companyId } });
    const expected = new Map<string, number>();
    for (const title of titles) {
        const open = cents(title.amount) - cents(title.settledAmount);
        const signed = title.type === 'INCOME' ? open : -open;
        expected.set(title.controlAccountId, (expected.get(title.controlAccountId) ?? 0) + signed);
    }
    const controls = await db.journalLine.groupBy({
        by: ['accountId'],
        where: { journalEntry: { companyId }, accountId: { in: [...expected.keys()] } },
        _sum: { debit: true, credit: true },
    });
    for (const [accountId, expectedBalance] of expected) {
        const row = controls.find(item => item.accountId === accountId);
        expect(cents(row?._sum.debit) - cents(row?._sum.credit)).toBe(expectedBalance);
    }
}
