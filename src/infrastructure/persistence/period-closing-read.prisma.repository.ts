import { Injectable } from '@nestjs/common';
import type {
    IPeriodClosingReadRepository,
    PeriodClosingList,
} from '@/domain/repositories/period-closing-read.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

@Injectable()
export class PeriodClosingReadPrismaRepository implements IPeriodClosingReadRepository {
    constructor(private readonly prisma: PrismaService) {}

    async list(companyId: string): Promise<PeriodClosingList> {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { closedThrough: true, periodClosings: { orderBy: { throughDate: 'desc' } } },
            relationLoadStrategy: 'join',
        });
        return {
            closedThrough: company?.closedThrough ?? null,
            items: company?.periodClosings ?? [],
        };
    }
}
