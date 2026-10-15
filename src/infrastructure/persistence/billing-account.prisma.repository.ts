import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AccountRef } from '@/domain/billing/account-ref.js';
import { toSortKey } from '@/domain/billing/account-code.js';
import {
    BillingAccountEntity,
    type NewBillingAccount,
} from '@/domain/entities/billing-account.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type {
    BillingAccountWithRefs,
    CodeGenerator,
    IBillingAccountRepository,
} from '@/domain/repositories/billing-account.repository.interface.js';
import {
    ACCOUNT_REFS,
    toAccountView,
} from '@/infrastructure/persistence/billing-account.prisma.mapper.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { isForeignKeyConstraintError, isUniqueConstraintError } from '@/utils/prisma.utils.js';

@Injectable()
export class BillingAccountPrismaRepository implements IBillingAccountRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findById(companyId: string, id: string): Promise<BillingAccountWithRefs | null> {
        const row = await this.prisma.billingAccount.findFirst({
            where: { id, billingPlan: { companyId } },
            include: ACCOUNT_REFS,
            relationLoadStrategy: 'join',
        });
        return row ? toAccountView(row) : null;
    }

    async findParent(
        companyId: string,
        planId: string,
        parentId: string,
    ): Promise<BillingAccountEntity | null> {
        const row = await this.prisma.billingAccount.findFirst({
            where: { id: parentId, billingPlanId: planId, billingPlan: { companyId } },
        });
        return row ? BillingAccountEntity.fromPersistence(row) : null;
    }

    async insertWithNextCode(
        draft: NewBillingAccount,
        nextCode: CodeGenerator,
    ): Promise<BillingAccountWithRefs> {
        try {
            return await this.prisma.$transaction(async tx => {
                const parentCode = await this.lockAndReadParentCode(tx, draft);
                const siblings = await tx.billingAccount.findMany({
                    where: { billingPlanId: draft.billingPlanId, parentId: draft.parentId },
                    select: { code: true },
                });
                const code = nextCode(
                    parentCode,
                    siblings.map(sibling => sibling.code),
                );
                const row = await tx.billingAccount.create({
                    data: { ...draft, code, sortKey: toSortKey(code) },
                    include: ACCOUNT_REFS,
                    relationLoadStrategy: 'join',
                });
                return toAccountView(row);
            });
        } catch (err) {
            if (isUniqueConstraintError(err)) {
                throw new DomainError(
                    ErrorCode.CONFLICT,
                    'Conflito ao gerar o código da conta; tente novamente',
                );
            }
            throw err;
        }
    }

    async update(companyId: string, account: BillingAccountEntity): Promise<void> {
        await this.prisma.billingAccount.updateMany({
            where: { id: account.id, billingPlan: { companyId } },
            data: {
                name: account.name,
                isActive: account.isActive,
                accountType: account.accountType,
                dreCategory: account.dreCategory,
                balanceCategory: account.balanceCategory,
            },
        });
    }

    async hasChildren(id: string): Promise<boolean> {
        return (await this.prisma.billingAccount.count({ where: { parentId: id } })) > 0;
    }

    async isInUse(accountId: string): Promise<boolean> {
        const [lines, entries, presets, titles] = await Promise.all([
            this.prisma.journalLine.count({ where: { accountId } }),
            this.prisma.entry.count({ where: { billingAccountId: accountId } }),
            this.prisma.presetAccount.count({ where: { accountId } }),
            this.prisma.title.count({
                where: { OR: [{ controlAccountId: accountId }, { resultAccountId: accountId }] },
            }),
        ]);
        return lines + entries + presets + titles > 0;
    }

    async findRefsByIds(companyId: string, ids: readonly string[]): Promise<AccountRef[]> {
        if (ids.length === 0) return [];
        return this.prisma.billingAccount.findMany({
            where: { id: { in: [...ids] }, billingPlan: { companyId } },
            select: {
                id: true,
                billingPlanId: true,
                accountType: true,
                nature: true,
                isActive: true,
            },
        });
    }

    async delete(companyId: string, id: string): Promise<void> {
        try {
            await this.prisma.billingAccount.deleteMany({
                where: { id, billingPlan: { companyId } },
            });
        } catch (err) {
            if (isForeignKeyConstraintError(err)) {
                throw new DomainError(
                    ErrorCode.ACCOUNT_IN_USE,
                    'Exclusão bloqueada: a conta está em uso',
                );
            }
            throw err;
        }
    }

    async list(
        companyId: string,
        filter: { planId?: string },
        page: PageRequest,
    ): Promise<Page<BillingAccountWithRefs>> {
        const where = {
            billingPlan: { companyId },
            ...(filter.planId ? { billingPlanId: filter.planId } : {}),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.billingAccount.findMany({
                where,
                orderBy: [{ billingPlanId: 'asc' }, { sortKey: 'asc' }],
                skip: pageOffset(page),
                take: page.pageSize,
                include: ACCOUNT_REFS,
                relationLoadStrategy: 'join',
            }),
            this.prisma.billingAccount.count({ where }),
        ]);
        return {
            items: rows.map(toAccountView),
            page: page.page,
            pageSize: page.pageSize,
            total,
        };
    }

    async listByPlan(companyId: string, planId: string): Promise<BillingAccountWithRefs[]> {
        const rows = await this.prisma.billingAccount.findMany({
            where: { billingPlanId: planId, billingPlan: { companyId } },
            orderBy: { sortKey: 'asc' },
            include: ACCOUNT_REFS,
            relationLoadStrategy: 'join',
        });
        return rows.map(toAccountView);
    }

    /** Trava o pai (ou o plano, para raiz) e devolve o código do pai. */
    private async lockAndReadParentCode(
        tx: Prisma.TransactionClient,
        draft: NewBillingAccount,
    ): Promise<string | null> {
        if (!draft.parentId) {
            await tx.$queryRaw`SELECT "id" FROM "BillingPlan" WHERE "id" = ${draft.billingPlanId} FOR UPDATE`;
            return null;
        }
        const rows = await tx.$queryRaw<{ code: string }[]>`
            SELECT "code" FROM "BillingAccount" WHERE "id" = ${draft.parentId} FOR UPDATE`;
        if (!rows[0]) {
            throw new DomainError(
                ErrorCode.ACCOUNT_PARENT_INVALID,
                'A conta pai não existe neste plano',
            );
        }
        return rows[0].code;
    }
}
