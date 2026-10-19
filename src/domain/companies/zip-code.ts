/** Remove tudo que não é dígito. */
export function normalizeZipCode(raw: string): string {
    return raw.replace(/\D/g, '');
}

/** Um CEP válido tem 8 dígitos (aceita hífen). */
export function isValidZipCode(raw: string): boolean {
    return /^\d{5}-?\d{3}$/.test(raw.trim());
}
