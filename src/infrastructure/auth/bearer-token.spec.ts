import { UnauthorizedException } from '@nestjs/common';
import { extractBearerToken } from '@/infrastructure/auth/bearer-token.js';

describe('extractBearerToken', () => {
    it('devolve o token sem espaços nas pontas', () => {
        expect(extractBearerToken('Bearer  abc.def.ghi ')).toBe('abc.def.ghi');
    });

    it.each([
        ['ausente', undefined],
        ['esquema Basic', 'Basic abc'],
        ['só "Bearer"', 'Bearer'],
        ['Bearer vazio', 'Bearer '],
        ['Bearer só com espaços', 'Bearer    '],
        ['minúsculo', 'bearer abc'],
    ])('401 quando %s', (_label, header) => {
        expect(() => extractBearerToken(header)).toThrow(UnauthorizedException);
    });
});
