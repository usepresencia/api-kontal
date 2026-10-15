import { useTestApp } from '@test/e2e/support/app.js';
import { seedLedger } from '@test/e2e/support/ledger-fixtures.js';

const { db } = useTestApp();
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('colunas de implantação do título (Postgres real)', () => {
    async function create(overrides: Record<string, unknown>) {
        const { company, preset, accounts } = await seedLedger(db());
        return db().title.create({
            data: {
                companyId: company.id,
                presetId: preset.id,
                controlAccountId: accounts.receivable,
                resultAccountId: accounts.revenue,
                type: 'INCOME',
                description: 'Cliente antigo',
                amount: '100.00',
                issueDate: day('2026-01-01'),
                expirationDate: day('2026-12-01'),
                ...overrides,
            },
        });
    }

    it('aceita título comum e título de implantação com data', async () => {
        expect((await create({})).isOpening).toBe(false);
        const opening = await create({ isOpening: true, openingDate: day('2026-10-01') });
        expect(opening.openingDate?.toISOString().slice(0, 10)).toBe('2026-10-01');
    });

    it('o CHECK recusa implantação sem data e data sem implantação', async () => {
        await expect(create({ isOpening: true })).rejects.toThrow();
        await expect(create({ openingDate: day('2026-10-01') })).rejects.toThrow();
    });

    it('aceita o papel openingBalance no preset', async () => {
        const { preset, accounts } = await seedLedger(db());
        await expect(
            db().presetAccount.create({
                data: { presetId: preset.id, role: 'openingBalance', accountId: accounts.bank },
            }),
        ).resolves.toMatchObject({ role: 'openingBalance' });
    });
});
