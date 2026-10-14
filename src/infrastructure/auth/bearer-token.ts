import { UnauthorizedException } from '@nestjs/common';

/**
 * Extrai o token do header `Authorization: Bearer <token>`.
 * @throws UnauthorizedException se o header estiver ausente, malformado ou vazio
 */
export function extractBearerToken(header: string | undefined): string {
    if (!header?.startsWith('Bearer ')) {
        throw new UnauthorizedException('Token não fornecido');
    }
    const token = header.substring(7).trim();
    if (!token) throw new UnauthorizedException('Token não fornecido');
    return token;
}
