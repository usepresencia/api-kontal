import { Injectable } from '@nestjs/common';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type {
    IJournalReadRepository,
    JournalFilter,
    JournalView,
} from '@/domain/repositories/journal-read.repository.interface.js';
import { loadJournalViews } from '@/infrastructure/persistence/journal-view.prisma.loader.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

function dateRange(filter: JournalFilter) {
    if (!filter.from && !filter.to) return {};
    return {
        date: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
        },
    };
}

@Injectable()
export class JournalReadPrismaRepository implements IJournalReadRepository {
    constructor(private readonly prisma: PrismaService) {}

    async find(companyId: string, id: string): Promise<JournalView | null> {
        const [view] = await loadJournalViews(this.prisma, {
            where: { id, companyId },
            orderBy: [],
        });
        return view ?? null;
    }

    async list(
        companyId: string,
        filter: JournalFilter,
        page: PageRequest,
    ): Promise<Page<JournalView>> {
        const where = {
            companyId,
            ...dateRange(filter),
            ...(filter.referenceType ? { referenceType: filter.referenceType } : {}),
            ...(filter.referenceId ? { referenceId: filter.referenceId } : {}),
            ...(filter.accountId ? { lines: { some: { accountId: filter.accountId } } } : {}),
        };
        const [items, total] = await Promise.all([
            loadJournalViews(this.prisma, {
                where,
                orderBy: [{ date: 'desc' }, { number: 'desc' }],
                skip: pageOffset(page),
                take: page.pageSize,
            }),
            this.prisma.journalEntry.count({ where }),
        ]);
        return { items, page: page.page, pageSize: page.pageSize, total };
    }
}
