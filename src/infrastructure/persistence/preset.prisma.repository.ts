import { Injectable } from '@nestjs/common';
import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type {
    IPresetRepository,
    PresetFilter,
    PresetView,
} from '@/domain/repositories/preset.repository.interface.js';
import {
    PRESET_REFS,
    toAccountRows,
    toPresetView,
} from '@/infrastructure/persistence/preset.prisma.mapper.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { isForeignKeyConstraintError } from '@/utils/prisma.utils.js';

@Injectable()
export class PresetPrismaRepository implements IPresetRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(preset: PresetEntity): Promise<void> {
        await this.prisma.preset.create({
            data: {
                id: preset.id,
                billingPlanId: preset.billingPlanId,
                name: preset.name,
                description: preset.description,
                isActive: preset.isActive,
                createdAt: preset.createdAt,
                accounts: { create: toAccountRows(preset) },
            },
        });
    }

    async findById(companyId: string, id: string): Promise<PresetView | null> {
        const row = await this.prisma.preset.findFirst({
            where: { id, billingPlan: { companyId } },
            include: PRESET_REFS,
            relationLoadStrategy: 'join',
        });
        return row ? toPresetView(row) : null;
    }

    async list(
        companyId: string,
        filter: PresetFilter,
        page: PageRequest,
    ): Promise<Page<PresetView>> {
        const where = {
            billingPlan: { companyId },
            ...(filter.billingPlanId ? { billingPlanId: filter.billingPlanId } : {}),
            ...(filter.isActive === undefined ? {} : { isActive: filter.isActive }),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.preset.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: pageOffset(page),
                take: page.pageSize,
                include: PRESET_REFS,
                relationLoadStrategy: 'join',
            }),
            this.prisma.preset.count({ where }),
        ]);
        return {
            items: rows.map(toPresetView),
            page: page.page,
            pageSize: page.pageSize,
            total,
        };
    }

    async update(companyId: string, preset: PresetEntity): Promise<void> {
        await this.prisma.preset.update({
            where: { id: preset.id, billingPlan: { companyId } },
            data: {
                name: preset.name,
                description: preset.description,
                isActive: preset.isActive,
                accounts: { deleteMany: {}, create: toAccountRows(preset) },
            },
        });
    }

    async isInUse(id: string): Promise<boolean> {
        return (await this.prisma.title.count({ where: { presetId: id } })) > 0;
    }

    async delete(companyId: string, id: string): Promise<void> {
        try {
            await this.prisma.preset.deleteMany({ where: { id, billingPlan: { companyId } } });
        } catch (err) {
            if (isForeignKeyConstraintError(err)) {
                throw new DomainError(
                    ErrorCode.PRESET_IN_USE,
                    'Exclusão bloqueada: o preset está em uso',
                );
            }
            throw err;
        }
    }
}
