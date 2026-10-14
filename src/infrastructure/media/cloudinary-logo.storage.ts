import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.schema.js';
import type {
    ICompanyLogoStorage,
    SignedLogoUpload,
} from '@/domain/companies/company-logo-storage.port.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { signUploadParams } from '@/infrastructure/media/cloudinary-signature.js';
import { isCompanyLogoUrl, logoPublicId } from '@/infrastructure/media/logo-url.policy.js';

const ALLOWED_FORMATS = 'png,jpg,jpeg,webp';

@Injectable()
export class CloudinaryLogoStorage implements ICompanyLogoStorage {
    constructor(private readonly config: ConfigService<Env, true>) {}

    signUpload(companyId: string): SignedLogoUpload {
        const { cloudName, apiKey, apiSecret } = this.credentials();
        const timestamp = Math.floor(Date.now() / 1000);
        const publicId = logoPublicId(companyId);
        const signature = signUploadParams(
            {
                allowed_formats: ALLOWED_FORMATS,
                invalidate: true,
                overwrite: true,
                public_id: publicId,
                timestamp,
            },
            apiSecret,
        );
        return {
            cloudName,
            apiKey,
            timestamp,
            publicId,
            allowedFormats: ALLOWED_FORMATS,
            overwrite: true,
            invalidate: true,
            signature,
            uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        };
    }

    isOwnLogoUrl(companyId: string, url: string): boolean {
        return isCompanyLogoUrl(url, this.credentials().cloudName, companyId);
    }

    private credentials(): { cloudName: string; apiKey: string; apiSecret: string } {
        const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME', { infer: true });
        const apiKey = this.config.get('CLOUDINARY_API_KEY', { infer: true });
        const apiSecret = this.config.get('CLOUDINARY_API_SECRET', { infer: true });
        if (!cloudName || !apiKey || !apiSecret) {
            throw new DomainError(
                ErrorCode.MEDIA_NOT_CONFIGURED,
                'Armazenamento de imagens não configurado',
            );
        }
        return { cloudName, apiKey, apiSecret };
    }
}
