import { CompanyEntity } from '@/domain/entities/company.entity.js';
import { GrantKontalAccessService } from '@/application/provisioning/grant-kontal-access.service.js';
import { RevokeKontalAccessService } from '@/application/provisioning/revoke-kontal-access.service.js';

const COMPANY = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const OTHER = '4a7e1b3f-9c2d-4a6f-8b8e-2d3c4b5e6f70';

const accounts = { findByEmail: vi.fn(), create: vi.fn(), setMemberships: vi.fn() };
const companies = { findById: vi.fn(), findAllActive: vi.fn() };
const provisioning = { findById: vi.fn(), save: vi.fn() };

const grant = () => new GrantKontalAccessService(accounts, companies, provisioning);
const revoke = () => new RevokeKontalAccessService(accounts, provisioning);

beforeEach(() => {
    for (const fn of [
        ...Object.values(accounts),
        ...Object.values(companies),
        ...Object.values(provisioning),
    ]) {
        fn.mockReset();
    }
    provisioning.findById.mockResolvedValue(null);
    provisioning.save.mockResolvedValue(undefined);
    companies.findById.mockResolvedValue(CompanyEntity.create({ id: COMPANY, name: 'Presencia' }));
    accounts.setMemberships.mockResolvedValue(undefined);
});

const input = {
    eventId: 'evt-1',
    email: ' Dev@Presencia.com.br ',
    name: 'Dev',
    companyId: COMPANY,
    role: 'OWNER' as const,
};

describe('GrantKontalAccessService', () => {
    it('conta existente: inclui a empresa na claim mantendo as outras e registra o evento', async () => {
        accounts.findByEmail.mockResolvedValue({
            uid: 'u1',
            memberships: [{ companyId: OTHER, role: 'OPERATIONAL' }],
        });
        await expect(grant().execute(input)).resolves.toEqual({ alreadyProcessed: false });
        expect(accounts.findByEmail).toHaveBeenCalledWith('dev@presencia.com.br');
        expect(accounts.create).not.toHaveBeenCalled();
        expect(accounts.setMemberships).toHaveBeenCalledWith('u1', [
            { companyId: OTHER, role: 'OPERATIONAL' },
            { companyId: COMPANY, role: 'OWNER' },
        ]);
        expect(provisioning.save).toHaveBeenCalledWith({
            id: 'evt-1',
            action: 'GRANT',
            status: 'DONE',
            email: 'dev@presencia.com.br',
            companyId: COMPANY,
            role: 'OWNER',
            error: null,
        });
    });

    it('conta inexistente: cria no Firebase antes de definir a claim', async () => {
        accounts.findByEmail.mockResolvedValue(null);
        accounts.create.mockResolvedValue({ uid: 'u2', memberships: [] });
        await grant().execute(input);
        expect(accounts.create).toHaveBeenCalledWith({
            email: 'dev@presencia.com.br',
            name: 'Dev',
        });
        expect(accounts.setMemberships).toHaveBeenCalledWith('u2', [
            { companyId: COMPANY, role: 'OWNER' },
        ]);
    });

    it('evento já concluído não faz nada (idempotente)', async () => {
        provisioning.findById.mockResolvedValue({ id: 'evt-1', status: 'DONE' });
        await expect(grant().execute(input)).resolves.toEqual({ alreadyProcessed: true });
        expect(accounts.findByEmail).not.toHaveBeenCalled();
        expect(accounts.setMemberships).not.toHaveBeenCalled();
    });

    it('evento que falhou antes pode ser refeito', async () => {
        provisioning.findById.mockResolvedValue({ id: 'evt-1', status: 'FAILED' });
        accounts.findByEmail.mockResolvedValue({ uid: 'u1', memberships: [] });
        await expect(grant().execute(input)).resolves.toEqual({ alreadyProcessed: false });
    });

    it('empresa inexistente ou inativa lança COMPANY_NOT_FOUND sem tocar no Firebase', async () => {
        companies.findById.mockResolvedValue(null);
        await expect(grant().execute(input)).rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND' });
        companies.findById.mockResolvedValue(
            CompanyEntity.create({ id: COMPANY, name: 'X', isActive: false }),
        );
        await expect(grant().execute(input)).rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND' });
        expect(accounts.findByEmail).not.toHaveBeenCalled();
    });

    it('falha no Firebase registra FAILED e repassa o erro', async () => {
        accounts.findByEmail.mockRejectedValue(new Error('firebase fora do ar'));
        await expect(grant().execute(input)).rejects.toThrow('firebase fora do ar');
        expect(provisioning.save).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'FAILED', error: 'firebase fora do ar' }),
        );
    });

    it('limite de empresas na claim lança CLAIM_LIMIT_EXCEEDED e registra FAILED', async () => {
        accounts.findByEmail.mockResolvedValue({
            uid: 'u1',
            memberships: Array.from({ length: 8 }, (_, i) => ({
                companyId: `company-${i}`,
                role: 'OWNER',
            })),
        });
        await expect(grant().execute(input)).rejects.toMatchObject({
            code: 'CLAIM_LIMIT_EXCEEDED',
        });
        expect(accounts.setMemberships).not.toHaveBeenCalled();
        expect(provisioning.save).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'FAILED' }),
        );
    });
});

describe('RevokeKontalAccessService', () => {
    const revokeInput = { eventId: 'evt-2', email: 'Dev@Presencia.com.br', companyId: COMPANY };

    it('tira a empresa da claim e registra o evento', async () => {
        accounts.findByEmail.mockResolvedValue({
            uid: 'u1',
            memberships: [
                { companyId: COMPANY, role: 'OWNER' },
                { companyId: OTHER, role: 'OWNER' },
            ],
        });
        await expect(revoke().execute(revokeInput)).resolves.toEqual({ alreadyProcessed: false });
        expect(accounts.setMemberships).toHaveBeenCalledWith('u1', [
            { companyId: OTHER, role: 'OWNER' },
        ]);
        expect(provisioning.save).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'REVOKE', status: 'DONE', role: null }),
        );
    });

    it('conta inexistente ou sem a empresa não é erro e não grava claim', async () => {
        accounts.findByEmail.mockResolvedValue(null);
        await revoke().execute(revokeInput);
        accounts.findByEmail.mockResolvedValue({
            uid: 'u1',
            memberships: [{ companyId: OTHER, role: 'OWNER' }],
        });
        await revoke().execute({ ...revokeInput, eventId: 'evt-3' });
        expect(accounts.setMemberships).not.toHaveBeenCalled();
        expect(provisioning.save).toHaveBeenCalledTimes(2);
    });

    it('evento já concluído não faz nada (idempotente)', async () => {
        provisioning.findById.mockResolvedValue({ id: 'evt-2', status: 'DONE' });
        await expect(revoke().execute(revokeInput)).resolves.toEqual({ alreadyProcessed: true });
        expect(accounts.findByEmail).not.toHaveBeenCalled();
    });

    it('falha no Firebase registra FAILED e repassa o erro', async () => {
        accounts.findByEmail.mockRejectedValue(new Error('boom'));
        await expect(revoke().execute(revokeInput)).rejects.toThrow('boom');
        expect(provisioning.save).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'FAILED' }),
        );
    });
});
