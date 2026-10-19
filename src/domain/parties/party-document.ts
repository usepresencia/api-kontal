import { isValidCnpj } from '@/domain/companies/cnpj.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { isValidCpf } from '@/domain/parties/cpf.js';

/**
 * Devolve só os dígitos de um CPF ou CNPJ válido.
 * @throws DomainError VALIDATION_ERROR se não for um documento válido
 */
export function normalizePartyDocument(value: string): string {
    const digits = value.replace(/\D/g, '');
    const valid = digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits);
    if (!valid) {
        throw new DomainError(
            ErrorCode.VALIDATION_ERROR,
            'Documento inválido: informe um CPF ou CNPJ',
        );
    }
    return digits;
}
