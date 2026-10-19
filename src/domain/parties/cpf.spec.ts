import { describe, expect, it } from 'vitest';
import { isValidCpf } from '@/domain/parties/cpf.js';

describe('isValidCpf', () => {
    it('valida os dois dígitos verificadores', () => {
        expect(isValidCpf('52998224725')).toBe(true);
        expect(isValidCpf('52998224726')).toBe(false);
    });

    it('recusa CPF com todos os dígitos iguais', () => {
        expect(isValidCpf('00000000000')).toBe(false);
    });
});
