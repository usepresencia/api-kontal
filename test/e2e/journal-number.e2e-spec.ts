import { useTestApp } from '@test/e2e/support/app.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';

const { db } = useTestApp();

describe('número do lançamento', () => {
    it('é atribuído pelo banco em ordem crescente, único, e aceita o tipo MANUAL', async () => {
        const company = await createCompanyFixture(db(), { name: 'Empresa' });
        const plan = await createPlanFixture(db(), company.id);
        const root = await createAccountFixture(db(), {
            billingPlanId: plan.id,
            code: '1',
            level: 1,
        });
        const a = await createAccountFixture(db(), {
            billingPlanId: plan.id,
            parentId: root.id,
            code: '1.1',
            level: 2,
            accountType: 'ANALYTIC',
        });
        const b = await createAccountFixture(db(), {
            billingPlanId: plan.id,
            parentId: root.id,
            code: '1.2',
            level: 2,
            accountType: 'ANALYTIC',
        });
        const create = (referenceId: string, referenceType: 'MANUAL' | 'TITLE_CREATION') =>
            db().journalEntry.create({
                data: {
                    companyId: company.id,
                    date: new Date('2026-10-14T00:00:00.000Z'),
                    referenceType,
                    referenceId,
                    totalDebits: '1.00',
                    totalCredits: '1.00',
                    lines: {
                        create: [
                            { accountId: a.id, debit: '1.00' },
                            { accountId: b.id, credit: '1.00' },
                        ],
                    },
                },
            });
        const first = await create('r1', 'TITLE_CREATION');
        const second = await create('r2', 'MANUAL');
        expect(typeof first.number).toBe('bigint');
        expect(second.number > first.number).toBe(true);
        expect(second.referenceType).toBe('MANUAL');
    });
});
