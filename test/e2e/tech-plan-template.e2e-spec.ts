import { CreateBillingAccountService } from '@/application/billing/create-billing-account.service.js';
import { CreateBillingPlanService } from '@/application/billing/create-billing-plan.service.js';
import { CreatePresetService } from '@/application/ledger/presets/create-preset.service.js';
import { applyPlanTemplate } from '@/scripts/apply-plan-template.js';
import { countAccounts } from '@/scripts/templates/plan-template.index.js';
import { TECH_COMPANY_PLAN } from '@/scripts/templates/tech-company.plan.js';
import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { createCompanyFixture } from '@test/e2e/support/fixtures.js';
import { isoDay } from '@test/e2e/support/dates.js';

const { api, db, resolve } = useTestApp();

const apply = async (companyId: string) =>
    applyPlanTemplate(
        {
            createPlan: resolve(CreateBillingPlanService),
            createAccount: resolve(CreateBillingAccountService),
            createPreset: resolve(CreatePresetService),
        },
        companyId,
        TECH_COMPANY_PLAN,
    );

describe('plano de contas padrão de empresa de tecnologia', () => {
    it('cria o plano padrão, todas as contas e todos os presets pelas regras de domínio', async () => {
        const company = await createCompanyFixture(db(), { name: 'Presencia Ltda' });
        const result = await apply(company.id);

        expect(result.accounts).toBe(countAccounts(TECH_COMPANY_PLAN));
        expect(result.presets).toBe(TECH_COMPANY_PLAN.presets.length);
        const plan = await db().billingPlan.findUniqueOrThrow({ where: { id: result.planId } });
        expect(plan).toMatchObject({ companyId: company.id, isDefault: true });
        expect(await db().billingAccount.count({ where: { billingPlanId: plan.id } })).toBe(
            result.accounts,
        );
        expect(await db().preset.count({ where: { billingPlanId: plan.id } })).toBe(result.presets);
    });

    it('numera as raízes de 1 a 5 e herda as categorias nas contas analíticas', async () => {
        const company = await createCompanyFixture(db());
        const { planId } = await apply(company.id);
        const roots = await db().billingAccount.findMany({
            where: { billingPlanId: planId, parentId: null },
            orderBy: { code: 'asc' },
        });
        expect(roots.map(root => [root.code, root.name])).toEqual([
            ['1', 'ATIVO'],
            ['2', 'PASSIVO'],
            ['3', 'PATRIMÔNIO LÍQUIDO'],
            ['4', 'RECEITAS'],
            ['5', 'CUSTOS E DESPESAS'],
        ]);

        const cloud = await db().billingAccount.findFirstOrThrow({
            where: { billingPlanId: planId, name: 'Hospedagem e Nuvem' },
        });
        expect(cloud).toMatchObject({
            accountType: 'ANALYTIC',
            nature: 'EXPENSE',
            dreCategory: 'COST_OF_SALES',
            costBehavior: 'VARIABLE',
        });
        const saas = await db().billingAccount.findFirstOrThrow({
            where: { billingPlanId: planId, name: 'Assinaturas SaaS Recorrentes' },
        });
        expect(saas).toMatchObject({ nature: 'REVENUE', dreCategory: 'GROSS_REVENUE' });
        const opening = await db().billingAccount.findFirstOrThrow({
            where: { billingPlanId: planId, name: 'Saldo Inicial de Implantação' },
        });
        expect(opening).toMatchObject({ nature: 'EQUITY', balanceCategory: 'EQUITY' });
    });

    it('os presets criam títulos de receita e de despesa e a DRE responde', async () => {
        const company = await createCompanyFixture(db());
        const { planId } = await apply(company.id);
        const headers = { ...(await bearer('admin')), 'X-Tenant-Id': company.id };
        const presetId = async (name: string) =>
            (await db().preset.findFirstOrThrow({ where: { billingPlanId: planId, name } })).id;

        const income = await presetId('Assinaturas SaaS');
        const expense = await presetId('Hospedagem e Nuvem');
        const party = await api()
            .post('/api/v1/parties')
            .set(headers)
            .send({
                kind: 'BOTH',
                name: 'Cliente Exemplo',
                socialReason: 'Cliente Exemplo Ltda',
                document: '11.222.333/0001-81',
                email: 'cliente@exemplo.com',
                phone: '4533333333',
                defaultPresetId: income,
            })
            .expect(201);

        for (const [type, preset] of [
            ['INCOME', income],
            ['EXPENSE', expense],
        ] as const) {
            await api()
                .post('/api/v1/titles')
                .set(headers)
                .send({
                    presetId: preset,
                    partyId: party.body.id,
                    type,
                    description: `Teste ${type}`,
                    amount: '100.00',
                    issueDate: isoDay(-5),
                    expirationDate: isoDay(10),
                })
                .expect(201);
        }
        await api()
            .get(`/api/v1/reports/dre?start=${isoDay(-30)}&end=${isoDay(0)}`)
            .set(headers)
            .expect(200);
    });

    it('rodar o modelo duas vezes cria um segundo plano sem quebrar o primeiro', async () => {
        const company = await createCompanyFixture(db());
        const first = await apply(company.id);
        const second = await apply(company.id);
        expect(second.planId).not.toBe(first.planId);
        const defaults = await db().billingPlan.count({
            where: { companyId: company.id, isDefault: true },
        });
        expect(defaults).toBe(1);
    });
});
