import { Inject, Injectable } from '@nestjs/common';
import type {
    ICompanyLogoStorage,
    SignedLogoUpload,
} from '@/domain/companies/company-logo-storage.port.js';
import { LOGO_STORAGE } from '@/infrastructure/media/media.tokens.js';

@Injectable()
export class CreateLogoUploadSignatureService {
    constructor(@Inject(LOGO_STORAGE) private readonly storage: ICompanyLogoStorage) {}

    execute(companyId: string): SignedLogoUpload {
        return this.storage.signUpload(companyId);
    }
}
