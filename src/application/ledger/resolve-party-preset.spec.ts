import { resolvePartyPreset } from '@/application/ledger/resolve-party-preset.js';
import { PartyEntity } from '@/domain/entities/party.entity.js';
import { PresetEntity } from '@/domain/entities/preset.entity.js';
import { fakeTx, partyFixture, presetFixture } from '@test/support/ledger-fakes.js';

const tx = fakeTx();
const input = { partyId: 'pt1', type: 'EXPENSE' as const };

const partyWith = (changes: Partial<Parameters<typeof PartyEntity.create>[0]>) =>
    PartyEntity.create({
        id: 'pt1',
        companyId: 'c1',
        kind: 'SUPPLIER',
        name: 'Copel',
        socialReason: 'Companhia Paranaense de Energia',
        document: '11.222.333/0001-81',
        email: '',
        phone: '',
        address: null,
        defaultPresetId: 'pr1',
        ...changes,
    });

beforeEach(() => {
    tx.parties.find.mockReset().mockResolvedValue(partyFixture);
    tx.presets.find.mockReset().mockResolvedValue(presetFixture);
});

describe('resolvePartyPreset', () => {
    it('sem preset informado usa o padrão da contraparte', async () => {
        const result = await resolvePartyPreset(tx, 'c1', input);
        expect(tx.presets.find).toHaveBeenCalledWith('c1', 'pr1');
        expect(result.preset).toBe(presetFixture);
        expect(result.party).toBe(partyFixture);
    });

    it('o preset informado vale mais que o padrão', async () => {
        await resolvePartyPreset(tx, 'c1', { ...input, presetId: 'outro' });
        expect(tx.presets.find).toHaveBeenCalledWith('c1', 'outro');
    });

    it('contraparte de outro tenant ou inexistente lança PARTY_NOT_FOUND', async () => {
        tx.parties.find.mockResolvedValue(null);
        await expect(resolvePartyPreset(tx, 'c1', input)).rejects.toMatchObject({
            code: 'PARTY_NOT_FOUND',
        });
    });

    it('contraparte inativa lança PARTY_INACTIVE', async () => {
        tx.parties.find.mockResolvedValue(partyWith({ isActive: false }));
        await expect(resolvePartyPreset(tx, 'c1', input)).rejects.toMatchObject({
            code: 'PARTY_INACTIVE',
        });
    });

    it('cliente em título a pagar e fornecedor em título a receber lançam PARTY_KIND_MISMATCH', async () => {
        tx.parties.find.mockResolvedValue(partyWith({ kind: 'CLIENT' }));
        await expect(resolvePartyPreset(tx, 'c1', input)).rejects.toMatchObject({
            code: 'PARTY_KIND_MISMATCH',
        });
        tx.parties.find.mockResolvedValue(partyWith({ kind: 'SUPPLIER' }));
        await expect(
            resolvePartyPreset(tx, 'c1', { ...input, type: 'INCOME' }),
        ).rejects.toMatchObject({ code: 'PARTY_KIND_MISMATCH' });
    });

    it('sem preset informado nem padrão lança PARTY_PRESET_REQUIRED', async () => {
        tx.parties.find.mockResolvedValue(partyWith({ defaultPresetId: null }));
        await expect(resolvePartyPreset(tx, 'c1', input)).rejects.toMatchObject({
            code: 'PARTY_PRESET_REQUIRED',
        });
    });

    it('preset inexistente lança PRESET_NOT_FOUND e inativo PRESET_INACTIVE', async () => {
        tx.presets.find.mockResolvedValue(null);
        await expect(resolvePartyPreset(tx, 'c1', input)).rejects.toMatchObject({
            code: 'PRESET_NOT_FOUND',
        });
        tx.presets.find.mockResolvedValue(
            PresetEntity.fromPersistence({ ...presetFixture, isActive: false } as never),
        );
        await expect(resolvePartyPreset(tx, 'c1', input)).rejects.toMatchObject({
            code: 'PRESET_INACTIVE',
        });
    });
});
