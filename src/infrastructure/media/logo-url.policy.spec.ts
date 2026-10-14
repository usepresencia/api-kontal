import { isCompanyLogoUrl, logoPublicId } from '@/infrastructure/media/logo-url.policy.js';

const CLOUD = 'demo-cloud';
const COMPANY = 'c1';
const base = `https://res.cloudinary.com/${CLOUD}/image/upload`;

describe('logoPublicId', () => {
    it('é fixo por empresa', () => {
        expect(logoPublicId('c1')).toBe('kontal/companies/c1/logo');
    });
});

describe('isCompanyLogoUrl', () => {
    it.each([
        ['com versão e extensão', `${base}/v1700000000/kontal/companies/c1/logo.png`],
        ['sem versão', `${base}/kontal/companies/c1/logo.jpg`],
        ['sem extensão', `${base}/v123/kontal/companies/c1/logo`],
        ['webp', `${base}/v123/kontal/companies/c1/logo.webp`],
        ['jpeg', `${base}/v123/kontal/companies/c1/logo.jpeg`],
    ])('aceita %s', (_label, url) => {
        expect(isCompanyLogoUrl(url, CLOUD, COMPANY)).toBe(true);
    });

    it.each([
        [
            'http em vez de https',
            `http://res.cloudinary.com/${CLOUD}/image/upload/v1/kontal/companies/c1/logo.png`,
        ],
        [
            'outro host',
            `https://evil.example.com/${CLOUD}/image/upload/v1/kontal/companies/c1/logo.png`,
        ],
        [
            'outro cloud name',
            `https://res.cloudinary.com/outro/image/upload/v1/kontal/companies/c1/logo.png`,
        ],
        ['outra empresa', `${base}/v1/kontal/companies/c2/logo.png`],
        ['sufixo no id da empresa', `${base}/v1/kontal/companies/c10/logo.png`],
        ['outro arquivo', `${base}/v1/kontal/companies/c1/banner.png`],
        ['outra pasta', `${base}/v1/outra/companies/c1/logo.png`],
        [
            'recurso de vídeo',
            `https://res.cloudinary.com/${CLOUD}/video/upload/v1/kontal/companies/c1/logo.png`,
        ],
        ['extensão não permitida', `${base}/v1/kontal/companies/c1/logo.gif`],
        ['com query', `${base}/v1/kontal/companies/c1/logo.png?x=1`],
        ['com fragmento', `${base}/v1/kontal/companies/c1/logo.png#x`],
        [
            'com credenciais',
            `https://user:pass@res.cloudinary.com/${CLOUD}/image/upload/v1/kontal/companies/c1/logo.png`,
        ],
        [
            'com porta',
            `https://res.cloudinary.com:8443/${CLOUD}/image/upload/v1/kontal/companies/c1/logo.png`,
        ],
        ['texto que não é URL', 'não é uma url'],
        ['vazio', ''],
    ])('rejeita %s', (_label, url) => {
        expect(isCompanyLogoUrl(url, CLOUD, COMPANY)).toBe(false);
    });

    it('trata o cloud name como texto literal, não como expressão regular', () => {
        const url = 'https://res.cloudinary.com/abc/image/upload/v1/kontal/companies/c1/logo.png';
        expect(isCompanyLogoUrl(url, 'a.c', COMPANY)).toBe(false);
    });
});
