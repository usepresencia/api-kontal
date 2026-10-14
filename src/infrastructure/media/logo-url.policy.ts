/** `public_id` fixo do logo de uma empresa no Cloudinary. */
export function logoPublicId(companyId: string): string {
    return `kontal/companies/${companyId}/logo`;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Indica se a URL é exatamente o logo da empresa no cloud informado: HTTPS, host
 * `res.cloudinary.com`, sem credenciais, porta, query nem fragmento.
 */
export function isCompanyLogoUrl(raw: string, cloudName: string, companyId: string): boolean {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return false;
    }
    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'res.cloudinary.com' ||
        url.port ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
    ) {
        return false;
    }
    const path = new RegExp(
        `^/${escapeRegExp(cloudName)}/image/upload/(?:v\\d+/)?${escapeRegExp(logoPublicId(companyId))}(?:\\.(?:png|jpe?g|webp))?$`,
    );
    return path.test(url.pathname);
}
