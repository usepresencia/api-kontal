import type { Prisma } from '@prisma/client';
import type { AccountRef } from '@/domain/billing/account-ref.js';
import type { IAccountTxRepository } from '@/domain/repositories/ledger.unit-of-work.interface.js';

export class AccountTxRepository implements IAccountTxRepository {
    constructor(private readonly client: Prisma.TransactionClient) {}

    async findRefs(companyId: string, ids: readonly string[]): Promise<AccountRef[]> {
        if (ids.length === 0) return [];
        return this.client.billingAccount.findMany({
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
}
