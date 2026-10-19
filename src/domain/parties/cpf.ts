function checkDigit(digits: readonly number[], weightStart: number): number {
    const sum = digits.reduce((total, digit, index) => total + digit * (weightStart - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
}

/** Indica se o texto de 11 dígitos é um CPF com os dois dígitos verificadores corretos. */
export function isValidCpf(value: string): boolean {
    if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
    const digits = [...value].map(Number);
    return (
        checkDigit(digits.slice(0, 9), 10) === digits[9] &&
        checkDigit(digits.slice(0, 10), 11) === digits[10]
    );
}
