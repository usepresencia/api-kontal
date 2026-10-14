import { isValidStateCode, normalizeStateCode } from '@/domain/companies/state-code.js';
import { isValidZipCode, normalizeZipCode } from '@/domain/companies/zip-code.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { requiredText } from '@/domain/required-text.js';

export interface AddressInput {
    zipCode: string;
    street: string;
    number: string;
    complement?: string | null;
    neighborhood: string;
    city: string;
    state: string;
}

export interface CompanyAddressRow {
    zipCode: string;
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
}

export class CompanyAddress {
    private constructor(
        readonly zipCode: string,
        readonly street: string,
        readonly number: string,
        readonly complement: string | null,
        readonly neighborhood: string,
        readonly city: string,
        readonly state: string,
    ) {}

    /** Valida e normaliza o endereço (CEP só com dígitos, UF em maiúsculas). */
    static create(input: AddressInput): CompanyAddress {
        if (!isValidZipCode(input.zipCode)) {
            throw new DomainError(ErrorCode.VALIDATION_ERROR, 'CEP inválido');
        }
        if (!isValidStateCode(input.state)) {
            throw new DomainError(ErrorCode.VALIDATION_ERROR, 'UF inválida');
        }
        const complement = input.complement?.trim();
        return new CompanyAddress(
            normalizeZipCode(input.zipCode),
            requiredText(input.street, 'Logradouro'),
            requiredText(input.number, 'Número', 50),
            complement ? requiredText(complement, 'Complemento') : null,
            requiredText(input.neighborhood, 'Bairro'),
            requiredText(input.city, 'Cidade'),
            normalizeStateCode(input.state),
        );
    }

    static fromPersistence(row: CompanyAddressRow): CompanyAddress {
        return new CompanyAddress(
            row.zipCode,
            row.street,
            row.number,
            row.complement,
            row.neighborhood,
            row.city,
            row.state,
        );
    }
}
