import { CreatePartyService } from '@/application/parties/create-party.service.js';
import { DeletePartyService } from '@/application/parties/delete-party.service.js';
import { GetPartyService } from '@/application/parties/get-party.service.js';
import { UpdatePartyService } from '@/application/parties/update-party.service.js';
import { partyFixture, presetFixture } from '@test/support/ledger-fakes.js';

const input = {
    kind: 'SUPPLIER' as const,
    name: 'Copel',
    socialReason: 'Companhia Paranaense de Energia',
    document: '11.222.333/0001-81',
    email: '',
    phone: '',
    address: null,
    defaultPresetId: 'pr1',
};

function fakeParties() {
    return {
        create: vi.fn(),
        findById: vi.fn().mockResolvedValue({ party: partyFixture, defaultPresetName: 'Energia' }),
        list: vi.fn(),
        update: vi.fn(),
        documentTaken: vi.fn().mockResolvedValue(false),
        hasTitlesOfType: vi.fn().mockResolvedValue(false),
        isInUse: vi.fn().mockResolvedValue(false),
        delete: vi.fn(),
        presetInUse: vi.fn().mockResolvedValue(false),
    };
}

function fakePresets() {
    return {
        create: vi.fn(),
        findById: vi.fn().mockResolvedValue({
            preset: presetFixture,
            billingPlanName: 'Plano',
            accountNames: {},
        }),
        list: vi.fn(),
        update: vi.fn(),
        isInUse: vi.fn(),
        delete: vi.fn(),
    };
}

describe('CreatePartyService', () => {
    it('cria a contraparte com o preset padrão do tenant', async () => {
        const parties = fakeParties();
        const service = new CreatePartyService(parties, fakePresets());
        const view = await service.execute('c1', input);
        expect(parties.create).toHaveBeenCalledTimes(1);
        expect(parties.create.mock.calls[0][0]).toMatchObject({
            companyId: 'c1',
            document: '11222333000181',
        });
        expect(view.defaultPresetName).toBe('Energia');
    });

    it('recusa documento repetido no tenant com PARTY_DOCUMENT_TAKEN', async () => {
        const parties = fakeParties();
        parties.documentTaken.mockResolvedValue(true);
        const service = new CreatePartyService(parties, fakePresets());
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'PARTY_DOCUMENT_TAKEN',
        });
        expect(parties.create).not.toHaveBeenCalled();
        expect(parties.documentTaken).toHaveBeenCalledWith('c1', '11222333000181');
    });

    it('preset padrão de outro tenant lança PRESET_NOT_FOUND', async () => {
        const presets = fakePresets();
        presets.findById.mockResolvedValue(null);
        const service = new CreatePartyService(fakeParties(), presets);
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'PRESET_NOT_FOUND',
        });
    });

    it('aceita contraparte sem preset padrão', async () => {
        const service = new CreatePartyService(fakeParties(), fakePresets());
        await expect(
            service.execute('c1', { ...input, defaultPresetId: null }),
        ).resolves.toBeDefined();
    });
});

describe('UpdatePartyService', () => {
    it('edita ignorando o próprio documento na checagem de duplicidade', async () => {
        const parties = fakeParties();
        const service = new UpdatePartyService(parties, fakePresets());
        await service.execute('c1', 'pt1', { ...input, name: 'Copel Distribuição' });
        expect(parties.documentTaken).toHaveBeenCalledWith('c1', '11222333000181', 'pt1');
        expect(parties.update.mock.calls[0][1]).toMatchObject({ name: 'Copel Distribuição' });
    });

    it('documento de outra contraparte lança PARTY_DOCUMENT_TAKEN', async () => {
        const parties = fakeParties();
        parties.documentTaken.mockResolvedValue(true);
        const service = new UpdatePartyService(parties, fakePresets());
        await expect(service.execute('c1', 'pt1', input)).rejects.toMatchObject({
            code: 'PARTY_DOCUMENT_TAKEN',
        });
    });

    it('recusa mudar o tipo quando há títulos que ele deixaria de aceitar', async () => {
        const parties = fakeParties();
        parties.hasTitlesOfType.mockImplementation(
            async (_id: string, type: string) => type === 'EXPENSE',
        );
        const service = new UpdatePartyService(parties, fakePresets());
        await expect(
            service.execute('c1', 'pt1', { ...input, kind: 'CLIENT' }),
        ).rejects.toMatchObject({
            code: 'PARTY_KIND_MISMATCH',
        });
        expect(parties.update).not.toHaveBeenCalled();
    });

    it('permite mudar o tipo quando os títulos continuam compatíveis', async () => {
        const parties = fakeParties();
        parties.hasTitlesOfType.mockImplementation(
            async (_id: string, type: string) => type === 'EXPENSE',
        );
        const service = new UpdatePartyService(parties, fakePresets());
        await expect(
            service.execute('c1', 'pt1', { ...input, kind: 'BOTH' }),
        ).resolves.toBeDefined();
    });

    it('contraparte de outro tenant lança PARTY_NOT_FOUND', async () => {
        const parties = fakeParties();
        parties.findById.mockResolvedValue(null);
        const service = new UpdatePartyService(parties, fakePresets());
        await expect(service.execute('c1', 'x', input)).rejects.toMatchObject({
            code: 'PARTY_NOT_FOUND',
        });
    });
});

describe('DeletePartyService', () => {
    it('exclui a contraparte sem títulos', async () => {
        const parties = fakeParties();
        await new DeletePartyService(parties).execute('c1', 'pt1');
        expect(parties.delete).toHaveBeenCalledWith('c1', 'pt1');
    });

    it('contraparte com título lança PARTY_IN_USE e não apaga', async () => {
        const parties = fakeParties();
        parties.isInUse.mockResolvedValue(true);
        await expect(new DeletePartyService(parties).execute('c1', 'pt1')).rejects.toMatchObject({
            code: 'PARTY_IN_USE',
        });
        expect(parties.delete).not.toHaveBeenCalled();
    });
});

describe('GetPartyService', () => {
    it('lança PARTY_NOT_FOUND para contraparte de outro tenant', async () => {
        const parties = fakeParties();
        parties.findById.mockResolvedValue(null);
        await expect(new GetPartyService(parties).execute('c1', 'x')).rejects.toMatchObject({
            code: 'PARTY_NOT_FOUND',
        });
    });
});
