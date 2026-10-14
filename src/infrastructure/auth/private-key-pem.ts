const PEM_BEGIN = '-----BEGIN PRIVATE KEY-----';
const PEM_END = '-----END PRIVATE KEY-----';

/** Converte `\n` literais em quebras de linha e reformata uma chave PEM de linha única em linhas de 64 caracteres. */
export function normalizePrivateKeyPem(raw: string): string {
    const key = raw.replace(/\\n/g, '\n').trim();
    if (key.includes('\n')) return key;

    const beginIdx = key.indexOf(PEM_BEGIN);
    const endIdx = key.indexOf(PEM_END);
    if (beginIdx === -1 || endIdx === -1) return key;

    const body = key.slice(beginIdx + PEM_BEGIN.length, endIdx).replace(/\s/g, '');
    const lines = body.match(/.{1,64}/g) ?? [];
    return `${PEM_BEGIN}\n${lines.join('\n')}\n${PEM_END}\n`;
}
