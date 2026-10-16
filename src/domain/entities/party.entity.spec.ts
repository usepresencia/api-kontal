import { describe, expect, it } from 'vitest';
import { PartyEntity } from '@/domain/entities/party.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

const base = {
    id: 'p1',
    companyId: 'c1',
    kind: 'SUPPLIER' as const,
    name: 'Copel',
    socialReason: 'Companhia Paranaense de Energia',
    document: '11.222.333/0001-81',
    email: 'financeiro@copel.com',
    phone: '4133333333',
    address: null,
    defaultPresetId: 'preset-energia',
};

describe('PartyEntity', () => {
    it('cria a contraparte guardando só os dígitos do documento', () => {
        const party = PartyEntity.create(base);
        expect(party.document).toBe('11222333000181');
        expect(party.isActive).toBe(true);
    });

    it('recusa nome vazio e documento inválido', () => {
        expect(() => PartyEntity.create({ ...base, name: '  ' })).toThrow(DomainError);
        expect(() => PartyEntity.create({ ...base, document: '123' })).toThrow(DomainError);
    });

    it('fornecedor só movimenta título a pagar, cliente só a receber, ambos os dois', () => {
        const supplier = PartyEntity.create(base);
        const client = PartyEntity.create({ ...base, kind: 'CLIENT' });
        const both = PartyEntity.create({ ...base, kind: 'BOTH' });
        expect(supplier.canTransact('EXPENSE')).toBe(true);
        expect(supplier.canTransact('INCOME')).toBe(false);
        expect(client.canTransact('INCOME')).toBe(true);
        expect(client.canTransact('EXPENSE')).toBe(false);
        expect(both.canTransact('INCOME') && both.canTransact('EXPENSE')).toBe(true);
    });

    it('preserva id, tenant e criação ao editar', () => {
        const party = PartyEntity.create(base);
        const changed = party.withChanges({ ...base, name: 'Copel Distribuição', isActive: false });
        expect(changed.id).toBe(party.id);
        expect(changed.companyId).toBe(party.companyId);
        expect(changed.createdAt).toBe(party.createdAt);
        expect(changed.name).toBe('Copel Distribuição');
        expect(changed.isActive).toBe(false);
    });
});
