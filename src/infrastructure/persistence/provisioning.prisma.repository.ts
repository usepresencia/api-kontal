import { Injectable } from '@nestjs/common';
import type {
    IProvisioningRepository,
    ProvisioningRecord,
} from '@/domain/repositories/provisioning.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

@Injectable()
export class ProvisioningPrismaRepository implements IProvisioningRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findById(id: string): Promise<ProvisioningRecord | null> {
        return this.prisma.provisioning.findUnique({
            where: { id },
            select: {
                id: true,
                action: true,
                status: true,
                email: true,
                companyId: true,
                role: true,
                error: true,
            },
        });
    }

    async save(record: ProvisioningRecord): Promise<void> {
        const { id, ...data } = record;
        await this.prisma.provisioning.upsert({
            where: { id },
            create: { id, ...data },
            update: data,
        });
    }
}
