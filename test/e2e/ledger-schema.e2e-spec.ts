import { useTestApp } from '@test/e2e/support/app.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';

const { db } = useTestApp();
const issueDate = new Date('2026-10-01T00:00:00.000Z');
const expirationDate = new Date('2026-11-01T00:00:00.000Z');

async function seed() {
    const company = await createCompanyFixture(db(), { name: 'Empresa' });
    const plan = await createPlanFixture(db(), company.id);
    const root = await createAccountFixture(db(), { billingPlanId: plan.id, code: '1', level: 1 });
    const control = await createAccountFixture(db(), {
        billingPlanId: plan.id,
        parentId: root.id,
        code: '1.1',
        level: 2,
        accountType: 'ANALYTIC',
    });
    const result = await createAccountFixture(db(), {
        billingPlanId: plan.id,
        parentId: root.id,
        code: '1.2',
        level: 2,
        accountType: 'ANALYTIC',
    });
    const preset = await db().preset.create({ data: { billingPlanId: plan.id, name: 'Preset' } });
    const titleData = {
        companyId: company.id,
        presetId: preset.id,
        controlAccountId: control.id,
        resultAccountId: result.id,
        type: 'INCOME' as const,
        description: 'Título',
        amount: '1000.00',
        issueDate,
        expirationDate,
    };
    const title = await db().title.create({ data: titleData });
    return { company, plan, control, result, preset, title, titleData };
}

describe('restrições do banco: título', () => {
    it('aceita o título válido com defaults (aberto, nada abatido, juros zero)', async () => {
        const { title } = await seed();
        expect(title).toMatchObject({ status: 'OPEN' });
        expect(title.settledAmount.toFixed(2)).toBe('0.00');
        expect(title.feesPercentageMonthly.toFixed(2)).toBe('0.00');
    });

    it.each([
        ['valor zero', { amount: '0.00' }],
        ['abatido acima do valor', { settledAmount: '1000.01' }],
        ['abatido negativo', { settledAmount: '-1.00' }],
        ['juros acima de 1', { feesPercentageMonthly: '1.01' }],
    ])('recusa %s', async (_label, overrides) => {
        const { titleData } = await seed();
        await expect(db().title.create({ data: { ...titleData, ...overrides } })).rejects.toThrow();
    });

    it('recusa seriesId sem seriesIndex e índice repetido na mesma série', async () => {
        const { titleData, company } = await seed();
        const series = await db().titleSeries.create({
            data: {
                companyId: company.id,
                kind: 'INSTALLMENT',
                frequency: 'MONTHLY',
                totalCount: 2,
                baseDescription: 'Série',
                firstIssueDate: issueDate,
                firstExpirationDate: expirationDate,
            },
        });
        await expect(
            db().title.create({ data: { ...titleData, seriesId: series.id } }),
        ).rejects.toThrow();
        await db().title.create({ data: { ...titleData, seriesId: series.id, seriesIndex: 1 } });
        await expect(
            db().title.create({ data: { ...titleData, seriesId: series.id, seriesIndex: 1 } }),
        ).rejects.toThrow();
    });
});

describe('restrições do banco: baixa', () => {
    const entryData = (titleId: string, accountId: string | null) => ({
        titleId,
        kind: 'PAYMENT' as const,
        billingAccountId: accountId,
        principalAmount: '100.00',
        totalAmount: '100.00',
        paidAt: issueDate,
        paymentMethod: 'PIX' as const,
    });

    it('aceita pagamento com conta e baixa por perda sem conta', async () => {
        const { title, control } = await seed();
        await db().entry.create({ data: entryData(title.id, control.id) });
        await db().entry.create({
            data: {
                ...entryData(title.id, null),
                kind: 'WRITE_OFF',
                totalAmount: '0.00',
                paymentMethod: null,
            },
        });
    });

    it('recusa pagamento sem conta, principal zero e desconto negativo', async () => {
        const { title, control } = await seed();
        await expect(db().entry.create({ data: entryData(title.id, null) })).rejects.toThrow();
        await expect(
            db().entry.create({
                data: { ...entryData(title.id, control.id), principalAmount: '0.00' },
            }),
        ).rejects.toThrow();
        await expect(
            db().entry.create({
                data: { ...entryData(title.id, control.id), discountAmount: '-1.00' },
            }),
        ).rejects.toThrow();
    });
});

describe('restrições do banco: razão', () => {
    const journal = (
        companyId: string,
        referenceId: string,
        lines: object[],
        totals = '100.00',
    ) => ({
        companyId,
        date: issueDate,
        description: 'Lançamento',
        referenceType: 'TITLE_CREATION' as const,
        referenceId,
        totalDebits: totals,
        totalCredits: totals,
        lines: { create: lines },
    });

    it('aceita lançamento balanceado com linhas de um só lado', async () => {
        const { company, control, result } = await seed();
        const created = await db().journalEntry.create({
            data: journal(company.id, 'ok', [
                { accountId: control.id, debit: '100.00' },
                { accountId: result.id, credit: '100.00' },
            ]),
            include: { lines: true },
        });
        expect(created.lines).toHaveLength(2);
    });

    it('recusa totais diferentes, total zero e linha com os dois lados', async () => {
        const { company, control, result } = await seed();
        await expect(
            db().journalEntry.create({
                data: { ...journal(company.id, 'a', []), totalCredits: '90.00' },
            }),
        ).rejects.toThrow();
        await expect(
            db().journalEntry.create({ data: journal(company.id, 'b', [], '0.00') }),
        ).rejects.toThrow();
        await expect(
            db().journalEntry.create({
                data: journal(company.id, 'c', [
                    { accountId: control.id, debit: '100.00', credit: '100.00' },
                    { accountId: result.id, credit: '100.00' },
                ]),
            }),
        ).rejects.toThrow();
    });

    it('recusa referência repetida (um lançamento por evento)', async () => {
        const { company } = await seed();
        await db().journalEntry.create({ data: journal(company.id, 'dup', []) });
        await expect(
            db().journalEntry.create({ data: journal(company.id, 'dup', []) }),
        ).rejects.toThrow();
    });

    it('não deixa excluir conta com título, preset ou lançamento (chave estrangeira)', async () => {
        const { control } = await seed();
        await expect(db().billingAccount.delete({ where: { id: control.id } })).rejects.toThrow();
    });
});
