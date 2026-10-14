import { Injectable } from '@nestjs/common';
import { CompanyEntity } from '@/domain/entities/company.entity.js';
import { MembershipEntity } from '@/domain/entities/membership.entity.js';
import type {
    IMembershipRepository,
    MembershipWithCompany,
} from '@/domain/repositories/membership.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

@Injectable()
export class MembershipPrismaRepository implements IMembershipRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findByUserAndCompany(
        userId: string,
        companyId: string,
    ): Promise<MembershipEntity | null> {
        const row = await this.prisma.membership.findUnique({
            where: { companyId_userId: { companyId, userId } },
        });
        return row ? MembershipEntity.fromPersistence(row) : null;
    }

    async findActiveByUserId(userId: string): Promise<MembershipWithCompany[]> {
        const rows = await this.prisma.membership.findMany({
            where: { userId, isActive: true, company: { isActive: true } },
            include: { company: true },
            orderBy: { company: { name: 'asc' } },
        });
        return rows.map(({ company, ...membership }) => ({
            membership: MembershipEntity.fromPersistence(membership),
            company: CompanyEntity.fromPersistence(company),
        }));
    }
}
