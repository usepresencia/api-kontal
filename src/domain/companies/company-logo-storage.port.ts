export interface SignedLogoUpload {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    publicId: string;
    allowedFormats: string;
    overwrite: boolean;
    invalidate: boolean;
    signature: string;
    uploadUrl: string;
}

export interface ICompanyLogoStorage {
    /**
     * Assina os parâmetros do upload do logo da empresa.
     * @throws DomainError MEDIA_NOT_CONFIGURED se o Cloudinary não estiver configurado
     */
    signUpload(companyId: string): SignedLogoUpload;
    /**
     * Indica se a URL é o logo desta empresa no nosso Cloudinary.
     * @throws DomainError MEDIA_NOT_CONFIGURED se o Cloudinary não estiver configurado
     */
    isOwnLogoUrl(companyId: string, url: string): boolean;
}
