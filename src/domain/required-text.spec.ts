import { DomainError } from '@/domain/errors/domain-error.js';
import { requiredText } from '@/domain/required-text.js';

describe('requiredText', () => {
    it('apara espaços e devolve o texto', () => {
        expect(requiredText('  Padaria  ', 'Nome')).toBe('Padaria');
    });

    it.each([[''], ['   '], [undefined], [null]])(
        'rejeita %j com DomainError VALIDATION_ERROR citando o rótulo',
        value => {
            expect(() => requiredText(value, 'Nome')).toThrow(DomainError);
            expect(() => requiredText(value, 'Nome')).toThrow(
                expect.objectContaining({
                    code: 'VALIDATION_ERROR',
                    message: 'Nome é obrigatório',
                }),
            );
        },
    );

    it('rejeita texto acima do máximo e respeita o máximo informado', () => {
        expect(() => requiredText('x'.repeat(256), 'Nome')).toThrow(/excede 255 caracteres/);
        expect(requiredText('x'.repeat(20), 'Telefone', 20)).toHaveLength(20);
        expect(() => requiredText('x'.repeat(21), 'Telefone', 20)).toThrow(/excede 20 caracteres/);
    });
});
