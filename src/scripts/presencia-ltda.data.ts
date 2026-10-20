import type { CompanyData } from '@/domain/entities/company-profile.entity.js';

/**
 * Dados cadastrais da Presencia Ltda. Razão social, abertura, CNAE e regime vêm da consulta do
 * CNPJ na BrasilAPI (19/10/2026); e-mail, telefone e endereço foram informados pela empresa.
 */
export const PRESENCIA_LTDA: CompanyData = {
    name: 'Presencia Ltda',
    socialReason: '58.605.846 CESAR AUGUSTO DA SILVA PISA',
    cnpj: '58.605.846/0001-35',
    openingDate: new Date('2025-01-02T00:00:00.000Z'),
    cnae: '9511800',
    taxRegime: 'MEI',
    email: 'comercial@presencia.com.br',
    phone: '45991519765',
    address: {
        zipCode: '85920-073',
        street: 'Rua Enrico Fermi',
        number: '3404',
        complement: null,
        neighborhood: 'Biopark',
        city: 'Toledo',
        state: 'PR',
    },
};

/** Quem recebe acesso `OWNER` ao Kontal para a Presencia Ltda. */
export const PRESENCIA_LTDA_OWNERS: readonly string[] = [
    'kainak.natan@presencia.com.br',
    'luiz.lucas@presencia.com.br',
    'pisa.cesar@presencia.com.br',
];
