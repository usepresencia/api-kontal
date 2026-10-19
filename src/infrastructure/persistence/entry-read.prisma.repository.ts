import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type {
    EntryFilter,
    EntryView,
    IEntryReadRepository,
} from '@/domain/repositories/entry-read.repository.interface.js';
import { toEntryEntity } from '@/infrastructure/persistence/entry.prisma.mapper.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const ENTRY_REFS = {
    title: { select: { description: true, type: true } },
    billingAccount: { select: { name: true } },
} as const;
type EntryWithRefs = Prisma.EntryGetPayload<{ include: typeof ENTRY_REFS }>;

function toView(row: EntryWithRefs): EntryView {
    return {
        entry: toEntryEntity(row),
        titleDescription: row.title.description,
        titleType: row.title.type,
        billingAccountName: row.billingAccount?.name ?? null,
    };
}

function paidRange(filter: EntryFilter) {
    if (!filter.paidFrom && !filter.paidTo) return {};
    return {
        paidAt: {
            ...(filter.paidFrom ? { gte: filter.paidFrom } : {}),
            ...(filter.paidTo ? { lte: filter.paidTo } : {}),
        },
    };
}

@Injectable()
export class EntryReadPrismaRepository implements IEntryReadRepository {
    constructor(private readonly prisma: PrismaService) {}

    async find(companyId: string, id: string): Promise<EntryView | null> {
        const row = await this.prisma.entry.findFirst({
            where: { id, title: { companyId } },
            include: ENTRY_REFS,
            relationLoadStrategy: 'join',
        });
        return row ? toView(row) : null;
    }

    async list(
        companyId: string,
        filter: EntryFilter,
        page: PageRequest,
    ): Promise<Page<EntryView>> {
        const where = {
            title: {
                companyId,
                ...(filter.titleType ? { type: filter.titleType } : {}),
            },
            ...(filter.titleId ? { titleId: filter.titleId } : {}),
            ...(filter.billingAccountId ? { billingAccountId: filter.billingAccountId } : {}),
            ...paidRange(filter),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.entry.findMany({
                where,
                orderBy: [{ paidAt: 'desc' }, { id: 'asc' }],
                skip: pageOffset(page),
                take: page.pageSize,
                include: ENTRY_REFS,
                relationLoadStrategy: 'join',
            }),
            this.prisma.entry.count({ where }),
        ]);
        return { items: rows.map(toView), page: page.page, pageSize: page.pageSize, total };
    }
}
