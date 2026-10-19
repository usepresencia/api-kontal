import { MAX_ACCOUNT_LEVEL, nextAccountCode } from '@/domain/billing/account-code.js';
import { assertValidPlacement } from '@/domain/billing/account-hierarchy.policy.js';
import type { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountType } from '@/domain/billing/account-type.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

export interface MoveNode {
    id: string;
    code: string;
    level: number;
}

export interface MovingAccount extends MoveNode {
    accountType: AccountType;
    nature: AccountNature;
}

export interface MoveTarget extends MoveNode {
    accountType: AccountType;
    nature: AccountNature;
}

/** Novo código e nível de uma conta depois da mudança de posição. */
export interface AccountRecode {
    id: string;
    code: string;
    level: number;
}

const paddedSegment = (value: number, level: number): string =>
    level <= 3 ? String(value) : String(value).padStart(3, '0');

/**
 * Planeja a mudança de posição de uma conta: o novo código e nível dela e os das filhas.
 * A conta recebe o próximo código livre sob o novo pai; as filhas mantêm o número de cada
 * segmento, com o preenchimento do nível em que passam a ficar.
 * @throws DomainError ACCOUNT_MOVE_INVALID para dentro de si mesma, ACCOUNT_NATURE_MISMATCH com
 *   natureza diferente da do novo pai, e as recusas de posição (pai analítico, raiz analítica,
 *   mais de 5 níveis)
 */
export function planAccountMove(params: {
    account: MovingAccount;
    descendants: readonly MoveNode[];
    newParent: MoveTarget | null;
    /** Códigos das contas que já estão sob o novo pai. */
    siblingCodes: readonly string[];
}): AccountRecode[] {
    const { account, descendants, newParent, siblingCodes } = params;
    if (
        newParent &&
        (newParent.id === account.id || descendants.some(d => d.id === newParent.id))
    ) {
        throw new DomainError(
            ErrorCode.ACCOUNT_MOVE_INVALID,
            'A conta não pode ser movida para dentro de si mesma ou de uma filha',
        );
    }
    const level = assertValidPlacement(account.accountType, newParent);
    if (newParent && newParent.nature !== account.nature) {
        throw new DomainError(
            ErrorCode.ACCOUNT_NATURE_MISMATCH,
            'A natureza da conta deve ser a mesma da conta pai',
        );
    }
    const delta = level - account.level;
    const deepest = Math.max(account.level, ...descendants.map(d => d.level)) + delta;
    if (deepest > MAX_ACCOUNT_LEVEL) {
        throw new DomainError(
            ErrorCode.ACCOUNT_MAX_DEPTH_EXCEEDED,
            `A profundidade máxima permitida é de ${MAX_ACCOUNT_LEVEL} níveis`,
        );
    }

    const code = nextAccountCode(newParent?.code ?? null, level, siblingCodes);
    const moved: AccountRecode[] = [{ id: account.id, code, level }];
    for (const item of descendants) {
        const relative = item.code.slice(account.code.length + 1).split('.');
        const segments = relative.map((segment, index) =>
            paddedSegment(Number.parseInt(segment, 10), level + 1 + index),
        );
        moved.push({
            id: item.id,
            code: `${code}.${segments.join('.')}`,
            level: item.level + delta,
        });
    }
    return moved;
}
