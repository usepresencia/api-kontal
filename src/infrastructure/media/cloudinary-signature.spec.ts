import { signUploadParams } from '@/infrastructure/media/cloudinary-signature.js';

const params = {
    timestamp: 1700000000,
    public_id: 'kontal/companies/c1/logo',
    overwrite: true,
    invalidate: true,
    allowed_formats: 'png,jpg,jpeg,webp',
};

describe('signUploadParams', () => {
    it('assina os parâmetros ordenados por nome com SHA-1 e o segredo (vetor fixo)', () => {
        expect(signUploadParams(params, 'test-secret')).toBe(
            '83d81700c1c0ca554705ce313f3a65e49cbe0d7a',
        );
    });

    it('não depende da ordem em que os parâmetros são informados', () => {
        const reversed = Object.fromEntries(Object.entries(params).reverse());
        expect(signUploadParams(reversed, 'test-secret')).toBe(
            signUploadParams(params, 'test-secret'),
        );
    });

    it('muda quando o segredo ou algum parâmetro muda', () => {
        const base = signUploadParams(params, 'test-secret');
        expect(signUploadParams(params, 'outro-segredo')).not.toBe(base);
        expect(signUploadParams({ ...params, timestamp: 1700000001 }, 'test-secret')).not.toBe(
            base,
        );
    });
});
