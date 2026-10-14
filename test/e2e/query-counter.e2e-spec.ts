import { useTestApp } from '@test/e2e/support/app.js';

const { db, queries } = useTestApp();

describe('QueryCounter', () => {
    it('conta uma query SQL por operação do Prisma', async () => {
        const total = await queries().count(async () => {
            await db().company.findMany();
            await db().company.count();
        });
        expect(total).toBe(2);
    });

    it('não conta o que roda fora da medição', async () => {
        await db().company.count();
        const total = await queries().count(async () => {
            await db().company.count();
        });
        expect(total).toBe(1);
    });
});
