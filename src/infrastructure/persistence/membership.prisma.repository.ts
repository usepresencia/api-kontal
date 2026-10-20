import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CompanyEntity } from '@/domain/entities/company.entity.js';
import { MembershipEntity } from '@/domain/entities/membership.entity.js';
import type {
    IMembershipRepository,
    MembershipGrant,
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

    async reconcile(userId: string, grants: MembershipGrant[]): Promise<void> {
        const [companies, active] = await Promise.all([
            grants.length === 0
                ? []
                : this.prisma.company.findMany({
                      where: { id: { in: grants.map(grant => grant.companyId) } },
                      select: { id: true },
                  }),
            this.prisma.membership.findMany({
                where: { userId, isActive: true },
                select: { companyId: true, role: true },
            }),
        ]);
        const known = new Set(companies.map(company => company.id));
        const valid = grants.filter(grant => known.has(grant.companyId));
        const activeRoles = new Map(active.map(row => [row.companyId, row.role]));
        const wanted = new Set(valid.map(grant => grant.companyId));

        const toWrite = valid.filter(grant => activeRoles.get(grant.companyId) !== grant.role);
        const toDeactivate = active.filter(row => !wanted.has(row.companyId));
        if (toWrite.length === 0 && toDeactivate.length === 0) return;

        await this.prisma.$transaction(async tx => {
            for (const { companyId, role } of toWrite) {
                await tx.membership.upsert({
                    where: { companyId_userId: { companyId, userId } },
                    create: { id: randomUUID(), companyId, userId, role, isActive: true },
                    update: { role, isActive: true },
                });
            }
            if (toDeactivate.length > 0) {
                await tx.membership.updateMany({
                    where: {
                        userId,
                        isActive: true,
                        companyId: { in: toDeactivate.map(row => row.companyId) },
                    },
                    data: { isActive: false },
                });
            }
        });
    }
}
