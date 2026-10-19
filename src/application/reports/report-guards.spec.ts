import { assertDateRange } from '@/application/reports/assert-date-range.js';
import { resolveReportPlan } from '@/application/reports/resolve-report-plan.js';
import { fakePlans, planFixture } from '@test/support/billing-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('assertDateRange', () => {
    it('aceita início antes ou igual ao fim e recusa início depois do fim', () => {
        expect(() => assertDateRange(day('2026-10-01'), day('2026-10-31'))).not.toThrow();
        expect(() => assertDateRange(day('2026-10-01'), day('2026-10-01'))).not.toThrow();
        expect(() => assertDateRange(day('2026-10-02'), day('2026-10-01'))).toThrow(
            expect.objectContaining({ code: 'DATE_RANGE_INVALID' }),
        );
    });

    it('com maxDays recusa períodos maiores (o limite é inclusivo nos dois extremos)', () => {
        expect(() => assertDateRange(day('2026-01-01'), day('2026-12-31'), 365)).not.toThrow();
        expect(() => assertDateRange(day('2026-01-01'), day('2027-01-01'), 365)).toThrow(
            expect.objectContaining({ code: 'DATE_RANGE_INVALID' }),
        );
        expect(() => assertDateRange(day('2026-10-01'), day('2026-10-01'), 1)).not.toThrow();
    });
});

describe('resolveReportPlan', () => {
    const plans = fakePlans();
    beforeEach(() => {
        for (const fn of Object.values(plans)) fn.mockReset();
    });

    it('plano informado: confere que é da empresa e o devolve', async () => {
        plans.findById.mockResolvedValue(planFixture);
        await expect(resolveReportPlan(plans, 'c1', 'p1')).resolves.toBe('p1');
        expect(plans.findById).toHaveBeenCalledWith('c1', 'p1');
        expect(plans.list).not.toHaveBeenCalled();
    });

    it('plano de outra empresa ou inexistente: BILLING_PLAN_NOT_FOUND', async () => {
        plans.findById.mockResolvedValue(null);
        await expect(resolveReportPlan(plans, 'c1', 'x')).rejects.toMatchObject({
            code: 'BILLING_PLAN_NOT_FOUND',
        });
    });

    it('sem plano informado usa o plano padrão da empresa', async () => {
        plans.findDefault.mockResolvedValue(planFixture);
        await expect(resolveReportPlan(plans, 'c1', undefined)).resolves.toBe(planFixture.id);
        expect(plans.findDefault).toHaveBeenCalledWith('c1');
    });

    it('sem plano informado e sem plano padrão: BILLING_PLAN_REQUIRED', async () => {
        plans.findDefault.mockResolvedValue(null);
        await expect(resolveReportPlan(plans, 'c1', undefined)).rejects.toMatchObject({
            code: 'BILLING_PLAN_REQUIRED',
        });
    });
});
