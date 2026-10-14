import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

/**
 * Apara o texto e exige que não esteja vazio nem acima do máximo.
 * @throws DomainError VALIDATION_ERROR
 */
export function requiredText(value: string | null | undefined, label: string, max = 255): string {
    const text = value?.trim();
    if (!text) throw new DomainError(ErrorCode.VALIDATION_ERROR, `${label} é obrigatório`);
    if (text.length > max) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, `${label} excede ${max} caracteres`);
    }
    return text;
}
