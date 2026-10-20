import {
    assertTemplateConsistent,
    countAccounts,
    indexTemplate,
} from '@/scripts/templates/plan-template.index.js';
import { TECH_COMPANY_PLAN } from '@/scripts/templates/tech-company.plan.js';
import type { PlanTemplate } from '@/scripts/templates/plan-template.js';

describe('modelo de plano de contas de tecnologia', () => {
    it('é consistente: chaves únicas e presets com contas analíticas da natureza do papel', () => {
        expect(() => assertTemplateConsistent(TECH_COMPANY_PLAN)).not.toThrow();
    });

    it('tem as cinco raízes na ordem ATIVO, PASSIVO, PL, RECEITAS e CUSTOS E DESPESAS', () => {
        expect(TECH_COMPANY_PLAN.roots.map(root => root.name)).toEqual([
            'ATIVO',
            'PASSIVO',
            'PATRIMÔNIO LÍQUIDO',
            'RECEITAS',
            'CUSTOS E DESPESAS',
        ]);
    });

    it('todo preset usa a conta de saldo inicial de implantação (patrimônio líquido)', () => {
        const index = indexTemplate(TECH_COMPANY_PLAN);
        for (const preset of TECH_COMPANY_PLAN.presets) {
            expect(index.get(preset.accounts.openingBalance as string)?.nature).toBe('EQUITY');
        }
    });

    it('tem um tamanho razoável', () => {
        expect(countAccounts(TECH_COMPANY_PLAN)).toBeGreaterThan(100);
        expect(TECH_COMPANY_PLAN.presets.length).toBeGreaterThanOrEqual(10);
    });
});

describe('assertTemplateConsistent', () => {
    const base: PlanTemplate = {
        name: 'T',
        description: '',
        roots: [
            {
                name: 'ATIVO',
                type: 'SYNTHETIC',
                nature: 'ASSET',
                children: [{ name: 'Caixa', type: 'ANALYTIC', key: 'caixa' }],
            },
            {
                name: 'PASSIVO',
                type: 'SYNTHETIC',
                nature: 'LIABILITY',
                children: [{ name: 'Fornecedores', type: 'ANALYTIC', key: 'forn' }],
            },
        ],
        presets: [
            { name: 'P', description: '', accounts: { receivable: 'caixa', payable: 'forn' } },
        ],
    };

    it('aceita um modelo válido', () => {
        expect(() => assertTemplateConsistent(base)).not.toThrow();
    });

    it.each([
        [
            'chave repetida',
            {
                ...base,
                roots: [
                    base.roots[0],
                    {
                        ...base.roots[1],
                        children: [{ name: 'F', type: 'ANALYTIC' as const, key: 'caixa' }],
                    },
                ],
            },
            /repetida/,
        ],
        [
            'conta de preset inexistente',
            {
                ...base,
                presets: [
                    { ...base.presets[0], accounts: { receivable: 'caixa', payable: 'nada' } },
                ],
            },
            /não existe/,
        ],
        [
            'papel obrigatório ausente',
            { ...base, presets: [{ ...base.presets[0], accounts: { receivable: 'caixa' } }] },
            /sem o papel payable/,
        ],
        [
            'natureza errada para o papel',
            {
                ...base,
                presets: [
                    { ...base.presets[0], accounts: { receivable: 'forn', payable: 'forn' } },
                ],
            },
            /exige ASSET/,
        ],
        [
            'preset repetido',
            { ...base, presets: [base.presets[0], base.presets[0]] },
            /Preset repetido/,
        ],
    ])('recusa %s', (_label, template, message) => {
        expect(() => assertTemplateConsistent(template as PlanTemplate)).toThrow(message);
    });
});
