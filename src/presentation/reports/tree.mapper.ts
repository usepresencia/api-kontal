import type { AccountNode } from '@/domain/reports/account-tree.js';

export interface TreeResponse {
    id: string;
    code: string;
    name: string;
    level: number;
    accountType: string;
    children: TreeResponse[];
    [field: string]: unknown;
}

/** Nó da árvore com os dados da conta, os campos de `mapNode` e as filhas. */
export function toTreeResponse<V>(
    node: AccountNode<V>,
    mapNode: (node: AccountNode<V>) => Record<string, unknown>,
): TreeResponse {
    return {
        id: node.account.id,
        code: node.account.code,
        name: node.account.name,
        level: node.account.level,
        accountType: node.account.accountType,
        ...mapNode(node),
        children: node.children.map(child => toTreeResponse(child, mapNode)),
    };
}
