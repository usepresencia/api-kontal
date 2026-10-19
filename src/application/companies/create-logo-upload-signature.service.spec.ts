import { CreateLogoUploadSignatureService } from '@/application/companies/create-logo-upload-signature.service.js';
import type { ICompanyLogoStorage } from '@/domain/companies/company-logo-storage.port.js';

const storage = { signUpload: vi.fn(), isOwnLogoUrl: vi.fn() } satisfies ICompanyLogoStorage;

describe('CreateLogoUploadSignatureService', () => {
    it('pede ao armazenamento a assinatura do upload da empresa', () => {
        const signed = { signature: 'abc' };
        storage.signUpload.mockReturnValue(signed);
        expect(new CreateLogoUploadSignatureService(storage).execute('c1')).toBe(signed);
        expect(storage.signUpload).toHaveBeenCalledWith('c1');
    });

    it('propaga MEDIA_NOT_CONFIGURED', () => {
        const unconfigured = Object.assign(new Error('x'), { code: 'MEDIA_NOT_CONFIGURED' });
        storage.signUpload.mockImplementation(() => {
            throw unconfigured;
        });
        expect(() => new CreateLogoUploadSignatureService(storage).execute('c1')).toThrow(
            unconfigured,
        );
    });
});
