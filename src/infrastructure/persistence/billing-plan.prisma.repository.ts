import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

@Injectable()
export class BillingPlanPrismaRepository implements IBillingPlanRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(plan: BillingPlanEntity): Promise<BillingPlanEntity> {
        const data = {
            id: plan.id,
            companyId: plan.companyId,
            name: plan.name,
            description: plan.description,
            createdAt: plan.createdAt,
        };
        const isFirst =
            (await this.prisma.billingPlan.count({ where: { companyId: plan.companyId } })) === 0;
        try {
            const row = await this.prisma.billingPlan.create({
                data: { ...data, isDefault: isFirst },
            });
            return BillingPlanEntity.fromPersistence(row);
        } catch (error) {
            // Dois primeiros planos simultâneos: o índice único deixa só um como padrão.
            if (
                !isFirst ||
                !(error instanceof Prisma.PrismaClientKnownRequestError) ||
                error.code !== 'P2002'
            ) {
                throw error;
            }
            const row = await this.prisma.billingPlan.create({
                data: { ...data, isDefault: false },
            });
            return BillingPlanEntity.fromPersistence(row);
        }
    }

    async findDefault(companyId: string): Promise<BillingPlanEntity | null> {
        const row = await this.prisma.billingPlan.findFirst({
            where: { companyId, isDefault: true },
        });
        return row ? BillingPlanEntity.fromPersistence(row) : null;
    }

    async setDefault(companyId: string, id: string): Promise<void> {
        await this.prisma.$transaction([
            this.prisma.billingPlan.updateMany({
                where: { companyId, isDefault: true },
                data: { isDefault: false },
            }),
            this.prisma.billingPlan.updateMany({
                where: { id, companyId },
                data: { isDefault: true },
            }),
        ]);
    }

    async findById(companyId: string, id: string): Promise<BillingPlanEntity | null> {
        const row = await this.prisma.billingPlan.findFirst({ where: { id, companyId } });
        return row ? BillingPlanEntity.fromPersistence(row) : null;
    }

    async list(companyId: string, page: PageRequest): Promise<Page<BillingPlanEntity>> {
        const where = { companyId };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.billingPlan.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: pageOffset(page),
                take: page.pageSize,
            }),
            this.prisma.billingPlan.count({ where }),
        ]);
        return {
            items: rows.map(row => BillingPlanEntity.fromPersistence(row)),
            page: page.page,
            pageSize: page.pageSize,
            total,
        };
    }

    async update(plan: BillingPlanEntity): Promise<void> {
        await this.prisma.billingPlan.updateMany({
            where: { id: plan.id, companyId: plan.companyId },
            data: { name: plan.name, description: plan.description },
        });
    }

    async hasAccounts(planId: string): Promise<boolean> {
        return (await this.prisma.billingAccount.count({ where: { billingPlanId: planId } })) > 0;
    }

    async delete(companyId: string, id: string): Promise<void> {
        await this.prisma.billingPlan.deleteMany({ where: { id, companyId } });
    }
}
