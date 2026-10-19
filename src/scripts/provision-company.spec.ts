import { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import { formatProvisionReport } from '@/scripts/format-provision-report.js';
import { PRESENCIA_LTDA } from '@/scripts/presencia-ltda.data.js';
import { provisionCompany } from '@/scripts/provision-company.js';
import { TECH_COMPANY_PLAN } from '@/scripts/templates/tech-company.plan.js';

const COMPANY_ID = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';

vi.mock('@/scripts/apply-plan-template.js', () => ({
    applyPlanTemplate: vi.fn().mockResolvedValue({ planId: 'plan-1', accounts: 130, presets: 11 }),
}));
const { applyPlanTemplate } = await import('@/scripts/apply-plan-template.js');

const services = {
    createCompany: { execute: vi.fn() },
    listCompanies: { execute: vi.fn() },
    listPlans: { execute: vi.fn() },
    createPlan: { execute: vi.fn() },
    createAccount: { execute: vi.fn() },
    createPreset: { execute: vi.fn() },
    grantAccess: { execute: vi.fn() },
};
type Services = Parameters<typeof provisionCompany>[0];

const input = (apply: boolean) => ({
    company: PRESENCIA_LTDA,
    template: TECH_COMPANY_PLAN,
    owners: ['a@presencia.com.br', 'b@presencia.com.br'],
    eventPrefix: 'presencia-ltda',
    apply,
});
const run = (apply: boolean) => provisionCompany(services as unknown as Services, input(apply));

const existingCompany = () => CompanyProfileEntity.create({ id: COMPANY_ID, ...PRESENCIA_LTDA });

beforeEach(() => {
    for (const service of Object.values(services)) service.execute.mockReset();
    vi.mocked(applyPlanTemplate).mockClear();
    services.listCompanies.execute.mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 100,
        total: 0,
    });
    services.listPlans.execute.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    services.createCompany.execute.mockResolvedValue({ id: COMPANY_ID });
    services.grantAccess.execute.mockResolvedValue({ alreadyProcessed: false });
});

describe('provisionCompany', () => {
    it('simulação: não grava nada e descreve o que seria feito', async () => {
        const report = await run(false);
        expect(report).toMatchObject({
            applied: false,
            company: { id: null, status: 'to-create' },
            plan: { status: 'to-create' },
            owners: [
                { email: 'a@presencia.com.br', status: 'to-grant' },
                { email: 'b@presencia.com.br', status: 'to-grant' },
            ],
        });
        expect(services.createCompany.execute).not.toHaveBeenCalled();
        expect(applyPlanTemplate).not.toHaveBeenCalled();
        expect(services.grantAccess.execute).not.toHaveBeenCalled();
    });

    it('aplicação: cria a empresa, o plano e dá acesso OWNER com chave de evento por usuário', async () => {
        const report = await run(true);
        expect(services.createCompany.execute).toHaveBeenCalledWith(PRESENCIA_LTDA);
        expect(applyPlanTemplate).toHaveBeenCalledWith(
            expect.anything(),
            COMPANY_ID,
            TECH_COMPANY_PLAN,
        );
        expect(services.grantAccess.execute).toHaveBeenCalledWith({
            eventId: 'presencia-ltda:owner:a@presencia.com.br',
            email: 'a@presencia.com.br',
            companyId: COMPANY_ID,
            role: 'OWNER',
        });
        expect(report.company).toEqual({ id: COMPANY_ID, status: 'created' });
        expect(report.plan.status).toBe('created');
        expect(report.owners.map(owner => owner.status)).toEqual(['granted', 'granted']);
    });

    it('repetir: reaproveita a empresa pelo CNPJ, pula o plano existente e os acessos já feitos', async () => {
        services.listCompanies.execute.mockResolvedValue({
            items: [existingCompany()],
            page: 1,
            pageSize: 100,
            total: 1,
        });
        services.listPlans.execute.mockResolvedValue({
            items: [{ name: TECH_COMPANY_PLAN.name }],
            page: 1,
            pageSize: 100,
            total: 1,
        });
        services.grantAccess.execute.mockResolvedValue({ alreadyProcessed: true });

        const report = await run(true);
        expect(services.createCompany.execute).not.toHaveBeenCalled();
        expect(applyPlanTemplate).not.toHaveBeenCalled();
        expect(report.company).toEqual({ id: COMPANY_ID, status: 'existing' });
        expect(report.plan.status).toBe('existing');
        expect(report.owners.map(owner => owner.status)).toEqual(['already', 'already']);
    });

    it('acha a empresa em páginas seguintes da listagem', async () => {
        services.listCompanies.execute
            .mockResolvedValueOnce({ items: [], page: 1, pageSize: 100, total: 101 })
            .mockResolvedValueOnce({
                items: [existingCompany()],
                page: 2,
                pageSize: 100,
                total: 101,
            });
        const report = await run(false);
        expect(report.company.status).toBe('existing');
        expect(services.listCompanies.execute).toHaveBeenCalledTimes(2);
    });

    it('recusa um modelo inconsistente antes de qualquer gravação', async () => {
        const broken = {
            ...TECH_COMPANY_PLAN,
            presets: [{ name: 'X', description: '', accounts: {} }],
        };
        await expect(
            provisionCompany(services as unknown as Services, { ...input(true), template: broken }),
        ).rejects.toThrow(/sem o papel/);
        expect(services.createCompany.execute).not.toHaveBeenCalled();
    });
});

describe('formatProvisionReport', () => {
    it('avisa que é simulação e lista os usuários', async () => {
        const text = formatProvisionReport(await run(false));
        expect(text).toContain('SIMULAÇÃO');
        expect(text).toContain('a@presencia.com.br: receberá acesso OWNER');
        expect(text).toContain('Plano de contas: será criado');
    });

    it('confirma a aplicação com o id do plano', async () => {
        const text = formatProvisionReport(await run(true));
        expect(text).toContain('Provisão aplicada.');
        expect(text).toContain('plano plan-1');
    });
});
