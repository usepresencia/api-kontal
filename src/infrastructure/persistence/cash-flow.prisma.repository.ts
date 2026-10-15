import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaymentMethod } from '@/domain/entities/entry.entity.js';
import type { TitleType } from '@/domain/ledger/title-type.js';
import { parseMoney } from '@/domain/money.js';
import type { CashGroupBy, CashPayment, CashRow } from '@/domain/reports/cash-flow.js';
import type { ICashFlowRepository } from '@/domain/repositories/cash-flow.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

interface TotalsRow {
    accountId: string;
    bucket: string;
    type: TitleType;
    amount: string;
}

interface PaymentRow {
    entryId: string;
    titleId: string;
    titleDescription: string;
    type: TitleType;
    accountId: string;
    accountCode: string;
    accountName: string;
    paymentMethod: PaymentMethod;
    paidAt: Date;
    amount: string;
}

const BUCKETS = {
    month: Prisma.sql`to_char(e."paidAt", 'YYYY-MM')`,
    day: Prisma.sql`to_char(e."paidAt", 'YYYY-MM-DD')`,
    none: Prisma.sql`''`,
};

@Injectable()
export class CashFlowPrismaRepository implements ICashFlowRepository {
    constructor(private readonly prisma: PrismaService) {}

    async totals(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
        groupBy: CashGroupBy | undefined,
    ): Promise<CashRow[]> {
        const bucket = BUCKETS[groupBy ?? 'none'];
        const rows = await this.prisma.$queryRaw<TotalsRow[]>`
            SELECT e."billingAccountId" AS "accountId",
                   ${bucket} AS "bucket",
                   t."type"::text AS "type",
                   SUM(e."totalAmount")::text AS "amount"
            FROM "Entry" e
            JOIN "Title" t ON t."id" = e."titleId"
            JOIN "BillingAccount" a ON a."id" = e."billingAccountId"
            WHERE t."companyId" = ${companyId}
              AND a."billingPlanId" = ${planId}
              AND e."kind" = 'PAYMENT'
              AND e."paidAt" >= ${start}
              AND e."paidAt" <= ${end}
            GROUP BY 1, 2, 3`;
        return rows.map(row => ({
            accountId: row.accountId,
            bucket: row.bucket,
            type: row.type,
            amount: parseMoney(row.amount),
        }));
    }

    async payments(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
    ): Promise<CashPayment[]> {
        const rows = await this.prisma.$queryRaw<PaymentRow[]>`
            SELECT e."id" AS "entryId",
                   e."titleId" AS "titleId",
                   t."description" AS "titleDescription",
                   t."type"::text AS "type",
                   a."id" AS "accountId",
                   a."code" AS "accountCode",
                   a."name" AS "accountName",
                   e."paymentMethod"::text AS "paymentMethod",
                   e."paidAt" AS "paidAt",
                   e."totalAmount"::text AS "amount"
            FROM "Entry" e
            JOIN "Title" t ON t."id" = e."titleId"
            JOIN "BillingAccount" a ON a."id" = e."billingAccountId"
            WHERE t."companyId" = ${companyId}
              AND a."billingPlanId" = ${planId}
              AND e."kind" = 'PAYMENT'
              AND e."paidAt" >= ${start}
              AND e."paidAt" <= ${end}
            ORDER BY e."paidAt", a."sortKey", e."createdAt", e."id"`;
        return rows.map(row => ({ ...row, amount: parseMoney(row.amount) }));
    }
}
