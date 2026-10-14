const BASE_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const FULL_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Remove tudo que não é dígito. */
export function normalizeCnpj(raw: string): string {
    return raw.replace(/\D/g, '');
}

function checkDigit(digits: string, weights: readonly number[]): number {
    const sum = weights.reduce((acc, weight, index) => acc + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
}

/** Acrescenta os dois dígitos verificadores a uma base de 12 dígitos. */
export function appendCnpjCheckDigits(base12: string): string {
    const withFirst = `${base12}${checkDigit(base12, BASE_WEIGHTS)}`;
    return `${withFirst}${checkDigit(withFirst, FULL_WEIGHTS)}`;
}

/** Valida o CNPJ pelos dígitos verificadores (aceita pontuação). */
export function isValidCnpj(raw: string): boolean {
    const digits = normalizeCnpj(raw);
    if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
    return appendCnpjCheckDigits(digits.slice(0, 12)) === digits;
}
