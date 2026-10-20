import { ProvisioningPrismaRepository } from '@/infrastructure/persistence/provisioning.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const provisioning = { findUnique: vi.fn(), upsert: vi.fn() };
const repo = new ProvisioningPrismaRepository({ provisioning } as unknown as PrismaService);

const record = {
    id: 'evt-1',
    action: 'GRANT' as const,
    status: 'DONE' as const,
    email: 'a@b.c',
    companyId: 'c1',
    role: 'OWNER' as const,
    error: null,
};

describe('ProvisioningPrismaRepository', () => {
    it('findById lê o registro pelo id do evento', async () => {
        provisioning.findUnique.mockResolvedValue(record);
        await expect(repo.findById('evt-1')).resolves.toEqual(record);
        expect(provisioning.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'evt-1' } }),
        );
    });

    it('save grava ou substitui o registro de mesmo id', async () => {
        await repo.save(record);
        const { id, ...data } = record;
        expect(provisioning.upsert).toHaveBeenCalledWith({
            where: { id },
            create: { id, ...data },
            update: data,
        });
    });
});
