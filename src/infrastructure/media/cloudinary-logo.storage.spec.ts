import type { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.schema.js';
import { CloudinaryLogoStorage } from '@/infrastructure/media/cloudinary-logo.storage.js';

const configured = {
    CLOUDINARY_CLOUD_NAME: 'demo-cloud',
    CLOUDINARY_API_KEY: '123456789012345',
    CLOUDINARY_API_SECRET: 'test-secret',
};

const makeStorage = (values: Record<string, string | undefined>) =>
    new CloudinaryLogoStorage({
        get: (key: string) => values[key],
    } as unknown as ConfigService<Env, true>);

afterEach(() => {
    vi.useRealTimers();
});

describe('CloudinaryLogoStorage.signUpload', () => {
    it('devolve os parâmetros assinados do upload da empresa', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(1_700_000_000_000));
        expect(makeStorage(configured).signUpload('c1')).toEqual({
            cloudName: 'demo-cloud',
            apiKey: '123456789012345',
            timestamp: 1700000000,
            publicId: 'kontal/companies/c1/logo',
            allowedFormats: 'png,jpg,jpeg,webp',
            overwrite: true,
            invalidate: true,
            signature: '83d81700c1c0ca554705ce313f3a65e49cbe0d7a',
            uploadUrl: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
        });
    });

    it('sem configuração lança MEDIA_NOT_CONFIGURED', () => {
        expect(() => makeStorage({}).signUpload('c1')).toThrow(
            expect.objectContaining({ code: 'MEDIA_NOT_CONFIGURED' }),
        );
    });

    it.each([
        ['sem cloud name', { ...configured, CLOUDINARY_CLOUD_NAME: undefined }],
        ['sem api key', { ...configured, CLOUDINARY_API_KEY: undefined }],
        ['sem api secret', { ...configured, CLOUDINARY_API_SECRET: undefined }],
    ])('configuração %s lança MEDIA_NOT_CONFIGURED', (_label, values) => {
        expect(() => makeStorage(values).signUpload('c1')).toThrow(
            expect.objectContaining({ code: 'MEDIA_NOT_CONFIGURED' }),
        );
    });
});

describe('CloudinaryLogoStorage.isOwnLogoUrl', () => {
    it('valida a URL contra o cloud name configurado e a empresa', () => {
        const storage = makeStorage(configured);
        const url =
            'https://res.cloudinary.com/demo-cloud/image/upload/v1/kontal/companies/c1/logo.png';
        expect(storage.isOwnLogoUrl('c1', url)).toBe(true);
        expect(storage.isOwnLogoUrl('c2', url)).toBe(false);
    });

    it('sem configuração lança MEDIA_NOT_CONFIGURED', () => {
        expect(() => makeStorage({}).isOwnLogoUrl('c1', 'https://x')).toThrow(
            expect.objectContaining({ code: 'MEDIA_NOT_CONFIGURED' }),
        );
    });
});
