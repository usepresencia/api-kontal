import { createPartySchema, listPartiesQuerySchema } from '@/presentation/ledger/party.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const valid = {
    kind: 'SUPPLIER',
    name: ' Copel ',
    socialReason: 'Companhia Paranaense de Energia',
    document: '11.222.333/0001-81',
};

describe('createPartySchema', () => {
    it('aceita o corpo mínimo, apara o nome e assume e-mail e telefone vazios', () => {
        expect(createPartySchema.parse(valid)).toMatchObject({
            name: 'Copel',
            email: '',
            phone: '',
            address: null,
            defaultPresetId: null,
        });
    });

    it('aceita endereço e preset padrão, e deixa o documento com máscara para o domínio', () => {
        const parsed = createPartySchema.parse({
            ...valid,
            defaultPresetId: uuid,
            address: {
                zipCode: '80000000',
                street: 'Rua A',
                number: '10',
                neighborhood: 'Centro',
                city: 'Curitiba',
                state: 'PR',
            },
        });
        expect(parsed.document).toBe('11.222.333/0001-81');
        expect(parsed.address?.complement).toBeNull();
        expect(parsed.defaultPresetId).toBe(uuid);
    });

    it.each([
        ['tipo inválido', { kind: 'OUTRO' }],
        ['nome vazio', { name: ' ' }],
        ['preset que não é UUID', { defaultPresetId: 'x' }],
        [
            'UF com tamanho errado',
            {
                address: {
                    zipCode: '1',
                    street: 'a',
                    number: '1',
                    neighborhood: 'b',
                    city: 'c',
                    state: 'PRR',
                },
            },
        ],
    ])('recusa %s', (_label, change) => {
        expect(createPartySchema.safeParse({ ...valid, ...change }).success).toBe(false);
    });
});

describe('listPartiesQuerySchema', () => {
    it('converte isActive de texto e aceita tipo e busca', () => {
        expect(
            listPartiesQuerySchema.parse({ isActive: 'false', kind: 'CLIENT', search: ' co ' }),
        ).toMatchObject({ isActive: false, kind: 'CLIENT', search: 'co' });
    });
});
