import type {
    BillingAccountEntity,
    NewBillingAccount,
} from '@/domain/entities/billing-account.entity.js';
import type { Page, PageRequest } from '@/domain/pagination.js';

/** Conta com o nome do pai e do plano, lidos na mesma consulta. */
export interface BillingAccountWithRefs {
    account: BillingAccountEntity;
    parentName: string | null;
    billingPlanName: string;
}

export type CodeGenerator = (parentCode: string | null, siblingCodes: readonly string[]) => string;

export interface IBillingAccountRepository {
    findById(companyId: string, id: string): Promise<BillingAccountWithRefs | null>;
    /** Devolve o pai só se ele pertence ao plano e à empresa. */
    findParent(
        companyId: string,
        planId: string,
        parentId: string,
    ): Promise<BillingAccountEntity | null>;
    /**
     * Insere a conta gerando o código dentro de uma transação que trava o pai (ou o plano,
     * para contas raiz).
     * @throws DomainError CONFLICT se o código colidir mesmo com o lock
     */
    insertWithNextCode(
        draft: NewBillingAccount,
        nextCode: CodeGenerator,
    ): Promise<BillingAccountWithRefs>;
    update(companyId: string, account: BillingAccountEntity): Promise<void>;
    hasChildren(id: string): Promise<boolean>;
    /** Indica se a conta é usada por linha do razão, baixa, preset ou título. */
    isInUse(accountId: string): Promise<boolean>;
    delete(companyId: string, id: string): Promise<void>;
    list(
        companyId: string,
        filter: { planId?: string },
        page: PageRequest,
    ): Promise<Page<BillingAccountWithRefs>>;
    /** Todas as contas de um plano, em ordem natural de código. */
    listByPlan(companyId: string, planId: string): Promise<BillingAccountWithRefs[]>;
}
