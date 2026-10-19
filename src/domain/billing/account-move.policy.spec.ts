import { planAccountMove } from '@/domain/billing/account-move.policy.js';

const account = {
    id: 'a',
    code: '1.2',
    level: 2,
    accountType: 'SYNTHETIC',
    nature: 'ASSET',
} as const;
const child = { id: 'c', code: '1.2.1', level: 3 };
const grandchild = { id: 'g', code: '1.2.1.001', level: 4 };
const target = (over = {}) => ({
    id: 't',
    code: '1.3',
    level: 2,
    accountType: 'SYNTHETIC' as const,
    nature: 'ASSET' as const,
    ...over,
});

describe('planAccountMove', () => {
    it('dá à conta o próximo código livre sob o novo pai e leva as filhas junto', () => {
        const result = planAccountMove({
            account,
            descendants: [child, grandchild],
            newParent: target(),
            siblingCodes: ['1.3.1', '1.3.4'],
        });
        expect(result).toEqual([
            { id: 'a', code: '1.3.5', level: 3 },
            { id: 'c', code: '1.3.5.001', level: 4 },
            { id: 'g', code: '1.3.5.001.001', level: 5 },
        ]);
    });

    it('ajusta o preenchimento dos segmentos ao mudar de nível', () => {
        const deep = { id: 'x', code: '1.2.1.001', level: 4 };
        const result = planAccountMove({
            account: { ...account, id: 'a', code: '1.2.1', level: 3 },
            descendants: [deep],
            newParent: null,
            siblingCodes: ['1', '2'],
        });
        expect(result).toEqual([
            { id: 'a', code: '3', level: 1 },
            { id: 'x', code: '3.1', level: 2 },
        ]);
    });

    it('mover para a raiz usa o próximo código raiz', () => {
        const result = planAccountMove({
            account,
            descendants: [],
            newParent: null,
            siblingCodes: ['1', '2', '3'],
        });
        expect(result).toEqual([{ id: 'a', code: '4', level: 1 }]);
    });

    it('recusa mover a conta para dentro de si mesma ou de uma filha', () => {
        expect(() =>
            planAccountMove({
                account,
                descendants: [child],
                newParent: target({ id: 'a' }),
                siblingCodes: [],
            }),
        ).toThrow(expect.objectContaining({ code: 'ACCOUNT_MOVE_INVALID' }));
        expect(() =>
            planAccountMove({
                account,
                descendants: [child],
                newParent: target({ id: 'c' }),
                siblingCodes: [],
            }),
        ).toThrow(expect.objectContaining({ code: 'ACCOUNT_MOVE_INVALID' }));
    });

    it('recusa pai analítico, raiz analítica e natureza diferente', () => {
        expect(() =>
            planAccountMove({
                account,
                descendants: [],
                newParent: target({ accountType: 'ANALYTIC' }),
                siblingCodes: [],
            }),
        ).toThrow(expect.objectContaining({ code: 'ACCOUNT_PARENT_NOT_SYNTHETIC' }));
        expect(() =>
            planAccountMove({
                account: { ...account, accountType: 'ANALYTIC' },
                descendants: [],
                newParent: null,
                siblingCodes: [],
            }),
        ).toThrow(expect.objectContaining({ code: 'ACCOUNT_ANALYTIC_REQUIRES_PARENT' }));
        expect(() =>
            planAccountMove({
                account,
                descendants: [],
                newParent: target({ nature: 'LIABILITY' }),
                siblingCodes: [],
            }),
        ).toThrow(expect.objectContaining({ code: 'ACCOUNT_NATURE_MISMATCH' }));
    });

    it('recusa quando a subárvore passaria de 5 níveis', () => {
        expect(() =>
            planAccountMove({
                account,
                descendants: [child, grandchild],
                newParent: target({ level: 3, code: '1.3.1' }),
                siblingCodes: [],
            }),
        ).toThrow(expect.objectContaining({ code: 'ACCOUNT_MAX_DEPTH_EXCEEDED' }));
    });
});
