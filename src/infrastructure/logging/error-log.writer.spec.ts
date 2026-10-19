import { CompanyEntity } from '@/domain/entities/company.entity.js';
import type { ICompanyRepository } from '@/domain/repositories/company.repository.interface.js';
import { firebaseFirestore } from '@/infrastructure/auth/firebase.config.js';
import { ErrorLogWriter } from '@/infrastructure/logging/error-log.writer.js';

vi.mock('@/infrastructure/auth/firebase.config.js', () => ({ firebaseFirestore: vi.fn() }));

const add = vi.fn();
const companies = { findById: vi.fn(), findAllActive: vi.fn() } satisfies ICompanyRepository;
const base = {
    correlationId: 'abc12345',
    message: 'boom',
    code: 'INTERNAL_ERROR',
    status: 500,
    method: 'GET',
    path: '/api/v1/x',
};

beforeEach(() => {
    add.mockReset().mockResolvedValue(undefined);
    vi.mocked(firebaseFirestore).mockReturnValue({
        collection: () => ({ doc: () => ({ collection: () => ({ add }) }) }),
    } as never);
    companies.findById.mockReset().mockResolvedValue(null);
});

describe('ErrorLogWriter', () => {
    it('grava a entrada com o nome da empresa', async () => {
        companies.findById.mockResolvedValue(CompanyEntity.create({ id: 'c1', name: 'Padaria' }));
        await new ErrorLogWriter(companies).write({ ...base, companyId: 'c1' });
        expect(add).toHaveBeenCalledWith(
            expect.objectContaining({ module: 'api-kontal', tenantName: 'Padaria' }),
        );
    });

    it('não consulta a empresa quando não há companyId', async () => {
        await new ErrorLogWriter(companies).write(base);
        expect(companies.findById).not.toHaveBeenCalled();
        expect(add).toHaveBeenCalledOnce();
    });

    it('nunca lança, mesmo se o Firestore falhar', async () => {
        add.mockRejectedValue(new Error('firestore down'));
        await expect(new ErrorLogWriter(companies).write(base)).resolves.toBeUndefined();
    });

    it('segue gravando se a busca da empresa falhar', async () => {
        companies.findById.mockRejectedValue(new Error('db down'));
        await new ErrorLogWriter(companies).write({ ...base, companyId: 'c1' });
        expect(add).toHaveBeenCalledOnce();
    });
});
