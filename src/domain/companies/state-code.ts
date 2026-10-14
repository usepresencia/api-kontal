export const BRAZILIAN_STATES = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
] as const;

/** Sigla da UF em maiúsculas, sem espaços. */
export function normalizeStateCode(raw: string): string {
    return raw.trim().toUpperCase();
}

export function isValidStateCode(raw: string): boolean {
    return (BRAZILIAN_STATES as readonly string[]).includes(normalizeStateCode(raw));
}
