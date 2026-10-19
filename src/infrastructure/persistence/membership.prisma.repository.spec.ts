import { MembershipPrismaRepository } from '@/infrastructure/persistence/membership.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const A = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const B = '4a7e1b3f-9c2d-4a6f-8b8e-2d3c4b5e6f70';

function makeRepo(state: { companies: string[]; active: { companyId: string; role: string }[] }) {
    const tx = { membership: { upsert: vi.fn(), updateMany: vi.fn() } };
    const prisma = {
        company: {
            findMany: vi.fn().mockResolvedValue(state.companies.map(id => ({ id }))),
        },
        membership: { findMany: vi.fn().mockResolvedValue(state.active) },
        $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };
    return { tx, prisma, repo: new MembershipPrismaRepository(prisma as unknown as PrismaService) };
}

describe('MembershipPrismaRepository.reconcile', () => {
    it('cria o vínculo da empresa existente da claim', async () => {
        const { repo, tx } = makeRepo({ companies: [A], active: [] });
        await repo.reconcile('u1', [{ companyId: A, role: 'OWNER' }]);
        expect(tx.membership.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { companyId_userId: { companyId: A, userId: 'u1' } },
                create: expect.objectContaining({ companyId: A, userId: 'u1', role: 'OWNER' }),
                update: { role: 'OWNER', isActive: true },
            }),
        );
        expect(tx.membership.updateMany).not.toHaveBeenCalled();
    });

    it('não grava nada quando os vínculos já estão alinhados à claim', async () => {
        const { repo, prisma } = makeRepo({
            companies: [A],
            active: [{ companyId: A, role: 'OWNER' }],
        });
        await repo.reconcile('u1', [{ companyId: A, role: 'OWNER' }]);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('troca o papel quando a claim muda', async () => {
        const { repo, tx } = makeRepo({
            companies: [A],
            active: [{ companyId: A, role: 'OPERATIONAL' }],
        });
        await repo.reconcile('u1', [{ companyId: A, role: 'OWNER' }]);
        expect(tx.membership.upsert).toHaveBeenCalledTimes(1);
    });

    it('desativa os vínculos que saíram da claim', async () => {
        const { repo, tx } = makeRepo({
            companies: [A],
            active: [
                { companyId: A, role: 'OWNER' },
                { companyId: B, role: 'OWNER' },
            ],
        });
        await repo.reconcile('u1', [{ companyId: A, role: 'OWNER' }]);
        expect(tx.membership.updateMany).toHaveBeenCalledWith({
            where: { userId: 'u1', isActive: true, companyId: { in: [B] } },
            data: { isActive: false },
        });
        expect(tx.membership.upsert).not.toHaveBeenCalled();
    });

    it('claim vazia desativa todos os vínculos e não consulta empresas', async () => {
        const { repo, prisma, tx } = makeRepo({
            companies: [],
            active: [{ companyId: A, role: 'OWNER' }],
        });
        await repo.reconcile('u1', []);
        expect(prisma.company.findMany).not.toHaveBeenCalled();
        expect(tx.membership.updateMany).toHaveBeenCalledTimes(1);
    });

    it('ignora empresa da claim que não existe e não regrava a cada requisição', async () => {
        const { repo, prisma } = makeRepo({ companies: [], active: [] });
        await repo.reconcile('u1', [{ companyId: A, role: 'OWNER' }]);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
