import { AccountNature } from '@/domain/billing/account-nature.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { BillingAccountEntity } from '@/domain/entities/billing-account.entity.js';
import { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import type {
    BillingAccountWithRefs,
    IBillingAccountRepository,
} from '@/domain/repositories/billing-account.repository.interface.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';

export function fakePlans() {
    return {
        create: vi.fn(),
        findById: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        hasAccounts: vi.fn(),
        delete: vi.fn(),
    } satisfies IBillingPlanRepository;
}

export function fakeAccounts() {
    return {
        findById: vi.fn(),
        findParent: vi.fn(),
        insertWithNextCode: vi.fn(),
        update: vi.fn(),
        hasChildren: vi.fn(),
        isInUse: vi.fn(),
        findRefsByIds: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listByPlan: vi.fn(),
    } satisfies IBillingAccountRepository;
}

export const planFixture = BillingPlanEntity.create({
    id: 'p1',
    companyId: 'c1',
    name: 'Plano',
    description: 'desc',
});

export function accountFixture(
    overrides: Partial<{
        id: string;
        parentId: string | null;
        accountType: AccountType;
        nature: AccountNature;
        code: string;
        level: number;
    }> = {},
): BillingAccountEntity {
    return BillingAccountEntity.fromPersistence({
        id: overrides.id ?? 'a1',
        billingPlanId: 'p1',
        parentId: overrides.parentId ?? null,
        name: 'Ativo',
        accountType: overrides.accountType ?? AccountType.SYNTHETIC,
        nature: overrides.nature ?? AccountNature.ASSET,
        isActive: true,
        code: overrides.code ?? '1',
        level: overrides.level ?? 1,
        createdAt: new Date('2026-01-01'),
    });
}

export function viewFixture(account = accountFixture()): BillingAccountWithRefs {
    return { account, parentName: null, billingPlanName: 'Plano' };
}
