import type { Cents } from '@/domain/money.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';

export interface AccountNode<V> {
    account: ReportAccount;
    value: V;
    children: AccountNode<V>[];
}

export interface ValueOps<V> {
    zero: V;
    add(a: V, b: V): V;
}

export const CENTS_OPS: ValueOps<Cents> = { zero: 0, add: (a, b) => a + b };

/**
 * Árvore das contas informadas (na ordem recebida): cada nó soma o próprio valor direto e o das
 * filhas; contas sem valor direto e sem filhas mantidas ficam de fora; conta cujo pai não está na
 * lista vira raiz.
 */
export function buildAccountTree<V>(
    accounts: readonly ReportAccount[],
    direct: ReadonlyMap<string, V>,
    ops: ValueOps<V>,
): AccountNode<V>[] {
    const ids = new Set(accounts.map(account => account.id));
    const childrenOf = new Map<string, ReportAccount[]>();
    const roots: ReportAccount[] = [];
    for (const account of accounts) {
        if (account.parentId !== null && ids.has(account.parentId)) {
            const siblings = childrenOf.get(account.parentId) ?? [];
            siblings.push(account);
            childrenOf.set(account.parentId, siblings);
        } else {
            roots.push(account);
        }
    }
    const build = (account: ReportAccount): AccountNode<V> | null => {
        const children = (childrenOf.get(account.id) ?? [])
            .map(build)
            .filter((node): node is AccountNode<V> => node !== null);
        const own = direct.get(account.id);
        if (own === undefined && children.length === 0) return null;
        const value = children.reduce((sum, child) => ops.add(sum, child.value), own ?? ops.zero);
        return { account, value, children };
    };
    return roots.map(build).filter((node): node is AccountNode<V> => node !== null);
}

/** Nós da árvore em pré-ordem. */
export function flattenTree<V>(nodes: readonly AccountNode<V>[]): AccountNode<V>[] {
    return nodes.flatMap(node => [node, ...flattenTree(node.children)]);
}

/** Ids da conta e de todas as suas descendentes. */
export function descendantIds(accounts: readonly ReportAccount[], rootId: string): string[] {
    const ids = [rootId];
    for (let i = 0; i < ids.length; i++) {
        for (const account of accounts) if (account.parentId === ids[i]) ids.push(account.id);
    }
    return ids;
}
