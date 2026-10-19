export const MAX_ACCOUNT_LEVEL = 5;

/**
 * Próximo código de conta sob um pai: o maior sufixo entre os irmãos + 1.
 * Níveis 1 a 3 sem preenchimento (`1.2.3`); níveis 4 e 5 com 3 dígitos (`1.2.3.002`).
 */
export function nextAccountCode(
    parentCode: string | null,
    level: number,
    siblingCodes: readonly string[],
): string {
    const suffixes = siblingCodes
        .map(code => Number.parseInt(code.slice(code.lastIndexOf('.') + 1), 10))
        .filter(Number.isFinite);
    const next = (suffixes.length > 0 ? Math.max(...suffixes) : 0) + 1;
    const suffix = level <= 3 ? String(next) : String(next).padStart(3, '0');
    return parentCode ? `${parentCode}.${suffix}` : suffix;
}

/** Chave de ordenação natural: cada segmento numérico preenchido com zeros à esquerda. */
export function toSortKey(code: string): string {
    return code
        .split('.')
        .map(segment => segment.padStart(9, '0'))
        .join('.');
}
