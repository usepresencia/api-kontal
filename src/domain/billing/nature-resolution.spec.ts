import { AccountNature } from '@/domain/billing/account-nature.js';
import { resolveNature } from '@/domain/billing/nature-resolution.js';

const { ASSET, REVENUE } = AccountNature;
const expectCode = (fn: () => unknown, code: string) => {
    expect(fn).toThrow(expect.objectContaining({ code }));
};

describe('resolveNature', () => {
    it('conta raiz usa a natureza informada', () => {
        expect(resolveNature(null, ASSET)).toBe(ASSET);
    });

    it('conta raiz sem natureza é recusada', () => {
        expectCode(() => resolveNature(null, undefined), 'ACCOUNT_NATURE_REQUIRED');
    });

    it('filha herda a natureza do pai quando nada é informado', () => {
        expect(resolveNature(REVENUE, undefined)).toBe(REVENUE);
    });

    it('filha aceita a natureza igual à do pai', () => {
        expect(resolveNature(REVENUE, REVENUE)).toBe(REVENUE);
    });

    it('filha com natureza diferente da do pai é recusada', () => {
        expectCode(() => resolveNature(REVENUE, ASSET), 'ACCOUNT_NATURE_MISMATCH');
    });
});
