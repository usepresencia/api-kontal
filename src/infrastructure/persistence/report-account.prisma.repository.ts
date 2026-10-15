import { Injectable } from '@nestjs/common';
import type { IReportAccountRepository } from '@/domain/repositories/report-account.repository.interface.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

@Injectable()
export class ReportAccountPrismaRepository implements IReportAccountRepository {
    constructor(private readonly prisma: PrismaService) {}

    list(companyId: string, planId: string): Promise<ReportAccount[]> {
        return this.prisma.billingAccount.findMany({
            where: { billingPlanId: planId, billingPlan: { companyId } },
            orderBy: { sortKey: 'asc' },
            select: {
                id: true,
                parentId: true,
                code: true,
                name: true,
                level: true,
                nature: true,
                accountType: true,
                dreCategory: true,
                balanceCategory: true,
            },
        });
    }
}
