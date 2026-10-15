import { CreatePresetService } from '@/application/ledger/presets/create-preset.service.js';
import { DeletePresetService } from '@/application/ledger/presets/delete-preset.service.js';
import { GetPresetService } from '@/application/ledger/presets/get-preset.service.js';
import { ListPresetsService } from '@/application/ledger/presets/list-presets.service.js';
import { UpdatePresetService } from '@/application/ledger/presets/update-preset.service.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountRef } from '@/domain/billing/account-ref.js';
import { AccountType } from '@/domain/billing/account-type.js';
import type { PresetView } from '@/domain/repositories/preset.repository.interface.js';
import { fakePlans, planFixture, fakeAccounts } from '@test/support/billing-fakes.js';
import { fakePresetRepo, presetFixture } from '@test/support/ledger-fakes.js';

const ref = (
    id: string,
    nature: AccountNature,
    overrides: Partial<AccountRef> = {},
): AccountRef => ({
    id,
    billingPlanId: 'p1',
    accountType: AccountType.ANALYTIC,
    nature,
    isActive: true,
    ...overrides,
});
const refs = [
    ref('ar', AccountNature.ASSET),
    ref('ap', AccountNature.LIABILITY),
    ref('rev', AccountNature.REVENUE),
    ref('exp', AccountNature.EXPENSE),
];
const input = {
    billingPlanId: 'p1',
    name: 'Venda de serviços',
    accounts: { receivable: 'ar', payable: 'ap', revenue: 'rev', expense: 'exp' },
};
const stored: PresetView = {
    preset: presetFixture,
    billingPlanName: 'Plano',
    accountNames: {} as PresetView['accountNames'],
};

const presets = fakePresetRepo();
const plans = fakePlans();
const accounts = fakeAccounts();

beforeEach(() => {
    for (const repo of [presets, plans, accounts]) {
        for (const fn of Object.values(repo)) fn.mockReset();
    }
    plans.findById.mockResolvedValue(planFixture);
    accounts.findRefsByIds.mockResolvedValue(refs);
    presets.findById.mockResolvedValue(stored);
    presets.create.mockResolvedValue(undefined);
    presets.update.mockResolvedValue(undefined);
});

describe('CreatePresetService', () => {
    const service = new CreatePresetService(presets, plans, accounts);

    it('valida o plano e as contas da empresa, grava o preset e devolve a leitura com os nomes', async () => {
        const result = await service.execute('c1', input);
        const [created] = presets.create.mock.calls[0];
        expect(created).toMatchObject({
            billingPlanId: 'p1',
            name: 'Venda de serviços',
            isActive: true,
        });
        expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(accounts.findRefsByIds).toHaveBeenCalledWith(
            'c1',
            expect.arrayContaining(['ar', 'ap', 'rev', 'exp']),
        );
        expect(presets.findById).toHaveBeenCalledWith('c1', created.id);
        expect(result).toBe(stored);
    });

    it('plano de outra empresa ou inexistente lança BILLING_PLAN_NOT_FOUND', async () => {
        plans.findById.mockResolvedValue(null);
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'BILLING_PLAN_NOT_FOUND',
        });
        expect(presets.create).not.toHaveBeenCalled();
    });

    it('papel obrigatório ausente lança PRESET_ACCOUNT_INVALID sem consultar contas', async () => {
        await expect(
            service.execute('c1', { ...input, accounts: { payable: 'ap' } }),
        ).rejects.toMatchObject({ code: 'PRESET_ACCOUNT_INVALID' });
        expect(accounts.findRefsByIds).not.toHaveBeenCalled();
    });

    it('conta de outra empresa (não retornada pela consulta) lança PRESET_ACCOUNT_INVALID', async () => {
        accounts.findRefsByIds.mockResolvedValue(refs.slice(1));
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'PRESET_ACCOUNT_INVALID',
        });
        expect(presets.create).not.toHaveBeenCalled();
    });

    it('conta com natureza errada para o papel lança PRESET_ACCOUNT_INVALID', async () => {
        accounts.findRefsByIds.mockResolvedValue([
            ...refs.slice(0, 2),
            ref('rev', AccountNature.EXPENSE),
            refs[3],
        ]);
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'PRESET_ACCOUNT_INVALID',
        });
    });

    it('conta de outro plano lança PRESET_PLAN_MISMATCH', async () => {
        accounts.findRefsByIds.mockResolvedValue([
            ...refs.slice(0, 3),
            ref('exp', AccountNature.EXPENSE, { billingPlanId: 'p2' }),
        ]);
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'PRESET_PLAN_MISMATCH',
        });
    });
});

describe('UpdatePresetService', () => {
    const service = new UpdatePresetService(presets, accounts);

    it('substitui nome, status e contas dentro do plano do preset e devolve a leitura atualizada', async () => {
        await service.execute('c1', 'pr1', { ...input, name: 'Novo nome', isActive: false });
        const [companyId, updated] = presets.update.mock.calls[0];
        expect(companyId).toBe('c1');
        expect(updated).toMatchObject({
            id: 'pr1',
            billingPlanId: 'p1',
            name: 'Novo nome',
            isActive: false,
        });
        expect(presets.findById).toHaveBeenCalledTimes(2);
    });

    it('valida as contas contra o plano do preset, não contra o corpo', async () => {
        accounts.findRefsByIds.mockResolvedValue(
            refs.map(item => ({ ...item, billingPlanId: 'p2' })),
        );
        await expect(service.execute('c1', 'pr1', input)).rejects.toMatchObject({
            code: 'PRESET_PLAN_MISMATCH',
        });
        expect(presets.update).not.toHaveBeenCalled();
    });

    it('preset de outra empresa ou inexistente lança PRESET_NOT_FOUND', async () => {
        presets.findById.mockResolvedValue(null);
        await expect(service.execute('c1', 'x', input)).rejects.toMatchObject({
            code: 'PRESET_NOT_FOUND',
        });
    });
});

describe('DeletePresetService', () => {
    const service = new DeletePresetService(presets);

    it('exclui o preset sem títulos', async () => {
        presets.isInUse.mockResolvedValue(false);
        await service.execute('c1', 'pr1');
        expect(presets.delete).toHaveBeenCalledWith('c1', 'pr1');
    });

    it('preset em uso lança PRESET_IN_USE', async () => {
        presets.isInUse.mockResolvedValue(true);
        await expect(service.execute('c1', 'pr1')).rejects.toMatchObject({ code: 'PRESET_IN_USE' });
        expect(presets.delete).not.toHaveBeenCalled();
    });

    it('preset de outra empresa lança PRESET_NOT_FOUND', async () => {
        presets.findById.mockResolvedValue(null);
        await expect(service.execute('c1', 'x')).rejects.toMatchObject({
            code: 'PRESET_NOT_FOUND',
        });
    });
});

describe('GetPresetService e ListPresetsService', () => {
    it('get devolve a leitura e lança PRESET_NOT_FOUND quando não acha', async () => {
        const service = new GetPresetService(presets);
        await expect(service.execute('c1', 'pr1')).resolves.toMatchObject({
            billingPlanName: 'Plano',
        });
        presets.findById.mockResolvedValue(null);
        await expect(service.execute('c1', 'x')).rejects.toMatchObject({
            code: 'PRESET_NOT_FOUND',
        });
    });

    it('list repassa empresa, filtro e página', async () => {
        const page = { items: [], page: 1, pageSize: 10, total: 0 };
        presets.list.mockResolvedValue(page);
        const result = await new ListPresetsService(presets).execute(
            'c1',
            { isActive: true },
            { page: 1, pageSize: 10 },
        );
        expect(result).toBe(page);
        expect(presets.list).toHaveBeenCalledWith(
            'c1',
            { isActive: true },
            { page: 1, pageSize: 10 },
        );
    });
});
