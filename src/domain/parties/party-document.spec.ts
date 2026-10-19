import { describe, expect, it } from 'vitest';
import { DomainError } from '@/domain/errors/domain-error.js';
import { normalizePartyDocument } from '@/domain/parties/party-document.js';

describe('normalizePartyDocument', () => {
    it('guarda só os dígitos de um CNPJ válido com máscara', () => {
        expect(normalizePartyDocument('11.222.333/0001-81')).toBe('11222333000181');
    });

    it('aceita um CPF válido com ou sem máscara', () => {
        expect(normalizePartyDocument('529.982.247-25')).toBe('52998224725');
        expect(normalizePartyDocument('52998224725')).toBe('52998224725');
    });

    it('recusa documento com dígito verificador errado', () => {
        expect(() => normalizePartyDocument('11.222.333/0001-80')).toThrow(DomainError);
        expect(() => normalizePartyDocument('529.982.247-24')).toThrow(DomainError);
    });

    it('recusa sequências repetidas e tamanhos que não são de CPF nem de CNPJ', () => {
        expect(() => normalizePartyDocument('111.111.111-11')).toThrow(DomainError);
        expect(() => normalizePartyDocument('123')).toThrow(DomainError);
    });
});
