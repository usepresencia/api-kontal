import type { IMembershipRepository } from '@/domain/repositories/membership.repository.interface.js';
import { MembershipReconciler } from '@/infrastructure/auth/membership.reconciler.js';

const A = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const repo = { reconcile: vi.fn() };
const reconciler = new MembershipReconciler(repo as unknown as IMembershipRepository);

beforeEach(() => repo.reconcile.mockReset().mockResolvedValue(undefined));

describe('MembershipReconciler', () => {
    it('entrega ao repositório as empresas da claim', async () => {
        await reconciler.reconcile('u1', [{ companyId: A, role: 'OWNER' }]);
        expect(repo.reconcile).toHaveBeenCalledWith('u1', [{ companyId: A, role: 'OWNER' }]);
    });

    it('claim ausente ou inválida desativa tudo (lista vazia)', async () => {
        await reconciler.reconcile('u1', undefined);
        await reconciler.reconcile('u1', [{ companyId: 'x', role: 'OWNER' }]);
        expect(repo.reconcile).toHaveBeenNthCalledWith(1, 'u1', []);
        expect(repo.reconcile).toHaveBeenNthCalledWith(2, 'u1', []);
    });
});
