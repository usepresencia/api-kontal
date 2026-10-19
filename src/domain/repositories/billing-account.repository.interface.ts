import type { AccountRecode } from '@/domain/billing/account-move.policy.js';
import type { AccountRef } from '@/domain/billing/account-ref.js';
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

/** Dados lidos, já com a trava, para planejar a mudança de posição de uma conta. */
export interface MoveContext {
    account: BillingAccountEntity;
    newParent: BillingAccountEntity | null;
    /** Todas as contas abaixo da que muda de posição. */
    descendants: BillingAccountEntity[];
    /** Códigos das contas que já estão sob o novo pai. */
    siblingCodes: string[];
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
    /**
     * Muda a conta de pai numa transação que trava o plano: `plan` decide o novo código e nível da
     * conta e das filhas, e o repositório grava tudo de uma vez.
     * @throws DomainError BILLING_ACCOUNT_NOT_FOUND se a conta sumiu, ACCOUNT_PARENT_INVALID se o novo pai
     *   não existe no plano, CONFLICT se o código colidir mesmo com a trava
     */
    moveWithRecode(
        companyId: string,
        planId: string,
        accountId: string,
        newParentId: string | null,
        plan: (context: MoveContext) => AccountRecode[],
    ): Promise<void>;
    update(companyId: string, account: BillingAccountEntity): Promise<void>;
    hasChildren(id: string): Promise<boolean>;
    /** Indica se a conta é usada por linha do razão, baixa, preset ou título. */
    isInUse(accountId: string): Promise<boolean>;
    /** Dados de compatibilidade das contas da empresa com os ids informados. */
    findRefsByIds(companyId: string, ids: readonly string[]): Promise<AccountRef[]>;
    delete(companyId: string, id: string): Promise<void>;
    list(
        companyId: string,
        filter: { planId?: string },
        page: PageRequest,
    ): Promise<Page<BillingAccountWithRefs>>;
    /** Todas as contas de um plano, em ordem natural de código. */
    listByPlan(companyId: string, planId: string): Promise<BillingAccountWithRefs[]>;
}
