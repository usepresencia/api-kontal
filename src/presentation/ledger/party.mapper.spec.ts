import { toPartyResponse } from '@/presentation/ledger/party.mapper.js';
import { partyFixture } from '@test/support/ledger-fakes.js';

describe('toPartyResponse', () => {
    it('devolve o documento só com dígitos, o endereço nulo e o nome do preset padrão', () => {
        const response = toPartyResponse({ party: partyFixture, defaultPresetName: 'Energia' });
        expect(response).toMatchObject({
            id: 'pt1',
            kind: 'BOTH',
            document: '11222333000181',
            address: null,
            defaultPresetId: 'pr1',
            defaultPresetName: 'Energia',
        });
        expect(typeof response.createdAt).toBe('string');
    });
});
