import { toPresetResponse } from '@/presentation/ledger/preset.mapper.js';
import { presetFixture } from '@test/support/ledger-fakes.js';

describe('toPresetResponse', () => {
    it('devolve o preset com id e nome de cada conta e null nos papéis vazios', () => {
        const response = toPresetResponse({
            preset: presetFixture,
            billingPlanName: 'Plano',
            accountNames: {
                receivable: 'Clientes',
                payable: 'Fornecedores',
                revenue: 'Vendas',
                expense: 'Despesas',
                interestIncome: 'Juros recebidos',
                discountGranted: 'Descontos concedidos',
                badDebt: 'Perdas',
                interestExpense: 'Juros pagos',
                discountObtained: 'Descontos obtidos',
                debtForgiveness: 'Perdão',
            },
        });
        expect(response).toMatchObject({
            id: 'pr1',
            billingPlanId: 'p1',
            billingPlanName: 'Plano',
            name: 'Venda de serviços',
            description: '',
            isActive: true,
        });
        expect(response.accounts.receivable).toEqual({ id: 'ar', name: 'Clientes' });
        expect(response.accounts.debtForgiveness).toEqual({ id: 'pf', name: 'Perdão' });
        expect(typeof response.createdAt).toBe('string');
    });

    it('papel sem conta vira null', () => {
        const names = {} as never;
        const preset = presetFixture.withChanges({
            name: 'x',
            accounts: { receivable: 'ar', payable: 'ap' },
        });
        const response = toPresetResponse({ preset, billingPlanName: 'P', accountNames: names });
        expect(response.accounts.revenue).toBeNull();
        expect(response.accounts.badDebt).toBeNull();
    });
});
