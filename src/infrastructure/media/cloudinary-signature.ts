import { createHash } from 'node:crypto';

export type SignableValue = string | number | boolean;

/** Assinatura de upload do Cloudinary: SHA-1 dos parâmetros ordenados por nome mais o segredo. */
export function signUploadParams(params: Record<string, SignableValue>, apiSecret: string): string {
    const stringToSign = Object.entries(params)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, value]) => `${key}=${String(value)}`)
        .join('&');
    return createHash('sha1').update(`${stringToSign}${apiSecret}`).digest('hex');
}
