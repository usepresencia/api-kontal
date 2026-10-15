import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { LedgerPrismaUnitOfWork } from '@/infrastructure/persistence/ledger/ledger.prisma.unit-of-work.js';

describe('LedgerPrismaUnitOfWork.run', () => {
    function makeUow() {
        const client = {};
        const prisma = {
            $transaction: vi.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(client)),
        };
        return {
            prisma,
            client,
            uow: new LedgerPrismaUnitOfWork(prisma as unknown as PrismaService),
        };
    }

    it('executa a função dentro de uma transação interativa e devolve o resultado', async () => {
        const { uow, prisma } = makeUow();
        const result = await uow.run(async tx => {
            expect(Object.keys(tx)).toEqual(
                expect.arrayContaining(['journal', 'presets', 'accounts', 'titles', 'entries']),
            );
            return 42;
        });
        expect(result).toBe(42);
        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
            timeout: 20000,
            maxWait: 10000,
        });
    });

    it('propaga o erro da função (a transação é revertida pelo Prisma)', async () => {
        const { uow } = makeUow();
        const boom = new Error('falhou');
        await expect(
            uow.run(async () => {
                throw boom;
            }),
        ).rejects.toBe(boom);
    });
});
