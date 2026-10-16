import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PartyEntity } from '@/domain/entities/party.entity.js';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type {
    IPartyRepository,
    PartyFilter,
    PartyView,
} from '@/domain/repositories/party.repository.interface.js';
import {
    PARTY_REFS,
    toAddressColumns,
    toPartyView,
} from '@/infrastructure/persistence/party.prisma.mapper.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

@Injectable()
export class PartyPrismaRepository implements IPartyRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(party: PartyEntity): Promise<void> {
        await this.prisma.party.create({ data: this.toData(party) });
    }

    async findById(companyId: string, id: string): Promise<PartyView | null> {
        const row = await this.prisma.party.findFirst({
            where: { id, companyId },
            include: PARTY_REFS,
            relationLoadStrategy: 'join',
        });
        return row ? toPartyView(row) : null;
    }

    async list(
        companyId: string,
        filter: PartyFilter,
        page: PageRequest,
    ): Promise<Page<PartyView>> {
        const digits = filter.search?.replace(/\D/g, '') ?? '';
        const where: Prisma.PartyWhereInput = {
            companyId,
            ...(filter.kind ? { kind: filter.kind } : {}),
            ...(filter.isActive === undefined ? {} : { isActive: filter.isActive }),
            ...(filter.search
                ? {
                      OR: [
                          { name: { contains: filter.search, mode: 'insensitive' } },
                          { socialReason: { contains: filter.search, mode: 'insensitive' } },
                          ...(digits ? [{ document: { contains: digits } }] : []),
                      ],
                  }
                : {}),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.party.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: pageOffset(page),
                take: page.pageSize,
                include: PARTY_REFS,
                relationLoadStrategy: 'join',
            }),
            this.prisma.party.count({ where }),
        ]);
        return { items: rows.map(toPartyView), page: page.page, pageSize: page.pageSize, total };
    }

    async update(companyId: string, party: PartyEntity): Promise<void> {
        await this.prisma.party.update({
            where: { id: party.id, companyId },
            data: this.toData(party),
        });
    }

    async documentTaken(companyId: string, document: string, exceptId?: string): Promise<boolean> {
        const found = await this.prisma.party.findFirst({
            where: { companyId, document, ...(exceptId ? { id: { not: exceptId } } : {}) },
            select: { id: true },
        });
        return found !== null;
    }

    async isInUse(id: string): Promise<boolean> {
        return (await this.prisma.title.count({ where: { partyId: id } })) > 0;
    }

    async delete(companyId: string, id: string): Promise<void> {
        await this.prisma.party.deleteMany({ where: { id, companyId } });
    }

    async presetInUse(presetId: string): Promise<boolean> {
        return (await this.prisma.party.count({ where: { defaultPresetId: presetId } })) > 0;
    }

    private toData(party: PartyEntity) {
        return {
            id: party.id,
            companyId: party.companyId,
            kind: party.kind,
            name: party.name,
            socialReason: party.socialReason,
            document: party.document,
            email: party.email,
            phone: party.phone,
            isActive: party.isActive,
            defaultPresetId: party.defaultPresetId,
            createdAt: party.createdAt,
            ...toAddressColumns(party.address),
        };
    }
}
