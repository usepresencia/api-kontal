import { normalizePrivateKeyPem } from '@/infrastructure/auth/private-key-pem.js';

const BEGIN = '-----BEGIN PRIVATE KEY-----';
const END = '-----END PRIVATE KEY-----';

describe('normalizePrivateKeyPem', () => {
    it('converte \\n literais em quebras de linha', () => {
        expect(normalizePrivateKeyPem(`${BEGIN}\\nabc\\n${END}`)).toBe(`${BEGIN}\nabc\n${END}`);
    });

    it('quebra o corpo base64 de uma chave em linha única em linhas de 64 caracteres', () => {
        const body = 'A'.repeat(130);
        const result = normalizePrivateKeyPem(`${BEGIN}${body}${END}`);
        expect(result).toBe(`${BEGIN}\n${'A'.repeat(64)}\n${'A'.repeat(64)}\nAA\n${END}\n`);
    });

    it('devolve a chave como está se não tiver o cabeçalho PEM', () => {
        expect(normalizePrivateKeyPem('not-a-pem')).toBe('not-a-pem');
    });
});
