import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type {
    ITitleReadRepository,
    TitleFilter,
    TitleView,
} from '@/domain/repositories/title-read.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { toTitleEntity } from '@/infrastructure/persistence/title.prisma.mapper.js';

const TITLE_REFS = {
    preset: { select: { name: true } },
    party: { select: { name: true } },
} as const;
type TitleWithRefs = Prisma.TitleGetPayload<{ include: typeof TITLE_REFS }>;

function toView(row: TitleWithRefs): TitleView {
    return { title: toTitleEntity(row), presetName: row.preset.name, partyName: row.party.name };
}

function dueRange(filter: TitleFilter) {
    if (!filter.dueFrom && !filter.dueTo) return {};
    return {
        expirationDate: {
            ...(filter.dueFrom ? { gte: filter.dueFrom } : {}),
            ...(filter.dueTo ? { lte: filter.dueTo } : {}),
        },
    };
}

@Injectable()
export class TitleReadPrismaRepository implements ITitleReadRepository {
    constructor(private readonly prisma: PrismaService) {}

    async find(companyId: string, id: string): Promise<TitleView | null> {
        const row = await this.prisma.title.findFirst({
            where: { id, companyId },
            include: TITLE_REFS,
            relationLoadStrategy: 'join',
        });
        return row ? toView(row) : null;
    }

    async list(
        companyId: string,
        filter: TitleFilter,
        page: PageRequest,
    ): Promise<Page<TitleView>> {
        const where = {
            companyId,
            ...(filter.type ? { type: filter.type } : {}),
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.presetId ? { presetId: filter.presetId } : {}),
            ...(filter.partyId ? { partyId: filter.partyId } : {}),
            ...(filter.seriesId ? { seriesId: filter.seriesId } : {}),
            ...dueRange(filter),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.title.findMany({
                where,
                orderBy: [{ expirationDate: 'asc' }, { id: 'asc' }],
                skip: pageOffset(page),
                take: page.pageSize,
                include: TITLE_REFS,
                relationLoadStrategy: 'join',
            }),
            this.prisma.title.count({ where }),
        ]);
        return { items: rows.map(toView), page: page.page, pageSize: page.pageSize, total };
    }
}
