import { AccountNature } from '@/domain/billing/account-nature.js';
import {
    buildAccountTree,
    CENTS_OPS,
    descendantIds,
    flattenTree,
} from '@/domain/reports/account-tree.js';
import { reportAccount, synthetic } from '@test/support/report-fakes.js';

const { ASSET } = AccountNature;
const accounts = [
    reportAccount('a1', '1', ASSET, synthetic),
    reportAccount('a11', '1.1', ASSET, { parentId: 'a1' }),
    reportAccount('a12', '1.2', ASSET, { parentId: 'a1', ...synthetic }),
    reportAccount('a121', '1.2.1', ASSET, { parentId: 'a12' }),
    reportAccount('a13', '1.3', ASSET, { parentId: 'a1' }),
    reportAccount('a2', '2', ASSET, synthetic),
    reportAccount('a21', '2.1', ASSET, { parentId: 'a2' }),
];

describe('buildAccountTree', () => {
    it('soma as analíticas nas sintéticas e poda os ramos sem valor', () => {
        const tree = buildAccountTree(
            accounts,
            new Map([
                ['a11', 100],
                ['a121', 50],
            ]),
            CENTS_OPS,
        );
        expect(tree).toHaveLength(1);
        expect(tree[0].account.id).toBe('a1');
        expect(tree[0].value).toBe(150);
        expect(tree[0].children.map(node => [node.account.id, node.value])).toEqual([
            ['a11', 100],
            ['a12', 50],
        ]);
        expect(tree[0].children[1].children.map(node => node.account.id)).toEqual(['a121']);
    });

    it('mantém conta com valor zero explícito e soma valor direto de sintética com o das filhas', () => {
        const tree = buildAccountTree(
            accounts,
            new Map([
                ['a1', 7],
                ['a13', 0],
            ]),
            CENTS_OPS,
        );
        expect(tree[0].value).toBe(7);
        expect(tree[0].children.map(node => node.account.id)).toEqual(['a13']);
    });

    it('conta cujo pai não está na lista vira raiz', () => {
        const tree = buildAccountTree(
            accounts.slice(3),
            new Map([
                ['a121', 5],
                ['a21', 9],
            ]),
            CENTS_OPS,
        );
        expect(tree.map(node => [node.account.id, node.value])).toEqual([
            ['a121', 5],
            ['a2', 9],
        ]);
    });

    it('sem valores devolve árvore vazia', () => {
        expect(buildAccountTree(accounts, new Map(), CENTS_OPS)).toEqual([]);
    });
});

describe('flattenTree', () => {
    it('lista os nós em pré-ordem (ordem do plano)', () => {
        const tree = buildAccountTree(
            accounts,
            new Map([
                ['a11', 1],
                ['a121', 1],
                ['a21', 1],
            ]),
            CENTS_OPS,
        );
        expect(flattenTree(tree).map(node => node.account.code)).toEqual([
            '1',
            '1.1',
            '1.2',
            '1.2.1',
            '2',
            '2.1',
        ]);
    });
});

describe('descendantIds', () => {
    it('devolve a conta e todas as descendentes; analítica devolve só ela', () => {
        expect(descendantIds(accounts, 'a1').sort()).toEqual(['a1', 'a11', 'a12', 'a121', 'a13']);
        expect(descendantIds(accounts, 'a11')).toEqual(['a11']);
    });
});
