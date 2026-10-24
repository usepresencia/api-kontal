import {
    addPeriods,
    buildInstallments,
    buildRecurrences,
    MAX_PER_GENERATION,
    MAX_PER_SERIES,
    SeriesFrequency,
    splitCents,
} from '@/domain/series/series-schedule.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const code = (value: string) => expect.objectContaining({ code: value });

describe('splitCents', () => {
    it('divide exatamente e coloca a sobra, 1 centavo por vez, nas primeiras parcelas', () => {
        expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
        expect(splitCents(10001, 3)).toEqual([3334, 3334, 3333]);
        expect(splitCents(9000, 3)).toEqual([3000, 3000, 3000]);
        expect(splitCents(5, 5)).toEqual([1, 1, 1, 1, 1]);
    });

    it('a soma das parcelas é sempre o total', () => {
        for (const [total, count] of [
            [100000, 7],
            [1, 1],
            [99999, 60],
            [123457, 12],
        ]) {
            expect(splitCents(total, count).reduce((a, b) => a + b, 0)).toBe(total);
        }
    });
});

describe('addPeriods', () => {
    it('semanal soma 7 dias por passo', () => {
        expect(iso(addPeriods(day('2026-10-14'), SeriesFrequency.WEEKLY, 2))).toBe('2026-10-28');
    });

    it('mensal mantém o dia e limita ao último dia do mês, sem deriva', () => {
        const base = day('2026-01-31');
        expect([1, 2, 3, 13].map(k => iso(addPeriods(base, SeriesFrequency.MONTHLY, k)))).toEqual([
            '2026-02-28',
            '2026-03-31',
            '2026-04-30',
            '2027-02-28',
        ]);
        expect(iso(addPeriods(day('2028-01-31'), SeriesFrequency.MONTHLY, 1))).toBe('2028-02-29');
    });

    it('anual mantém o dia e ajusta 29/fev para 28/fev em ano não bissexto', () => {
        expect(iso(addPeriods(day('2024-02-29'), SeriesFrequency.YEARLY, 1))).toBe('2025-02-28');
        expect(iso(addPeriods(day('2024-02-29'), SeriesFrequency.YEARLY, 4))).toBe('2028-02-29');
    });

    it('zero passos devolve a mesma data', () => {
        expect(iso(addPeriods(day('2026-05-17'), SeriesFrequency.MONTHLY, 0))).toBe('2026-05-17');
    });
});

describe('buildInstallments', () => {
    const base = {
        description: 'Venda',
        total: 90000,
        count: 3,
        frequency: SeriesFrequency.MONTHLY,
        issueDate: day('2026-10-14'),
        firstDue: day('2026-11-10'),
    };

    it('gera N parcelas com a mesma emissão, vencimentos mensais e descrição com a referência de mês/ano', () => {
        const items = buildInstallments(base);
        expect(
            items.map(i => [
                i.index,
                i.description,
                i.amount,
                iso(i.issueDate),
                iso(i.expirationDate),
            ]),
        ).toEqual([
            [1, 'Venda (nov/2026)', 30000, '2026-10-14', '2026-11-10'],
            [2, 'Venda (dez/2026)', 30000, '2026-10-14', '2026-12-10'],
            [3, 'Venda (jan/2027)', 30000, '2026-10-14', '2027-01-10'],
        ]);
    });

    it('distribui a sobra de centavos e soma o total', () => {
        const items = buildInstallments({ ...base, total: 10000 });
        expect(items.map(i => i.amount)).toEqual([3334, 3333, 3333]);
    });

    it.each([
        ['1 parcela', { count: 1 }],
        ['0 parcelas', { count: 0 }],
        ['parcelas fracionadas', { count: 2.5 }],
        ['total menor que o número de parcelas', { total: 2, count: 3 }],
    ])('rejeita %s com SERIES_INVALID', (_label, overrides) => {
        expect(() => buildInstallments({ ...base, ...overrides })).toThrow(code('SERIES_INVALID'));
    });

    it('rejeita mais de 60 parcelas com SERIES_LIMIT_EXCEEDED', () => {
        expect(MAX_PER_GENERATION).toBe(60);
        expect(() => buildInstallments({ ...base, total: 100000, count: 61 })).toThrow(
            code('SERIES_LIMIT_EXCEEDED'),
        );
        expect(buildInstallments({ ...base, total: 100000, count: 60 })).toHaveLength(60);
    });
});

describe('buildRecurrences', () => {
    const base = {
        description: 'Aluguel',
        amount: 250000,
        frequency: SeriesFrequency.MONTHLY,
        firstIssueDate: day('2026-11-05'),
        firstDue: day('2026-11-10'),
        startIndex: 1,
    };

    it('por quantidade: emissão e vencimento avançam juntos, valor igual, descrição com a referência de mês/ano', () => {
        const items = buildRecurrences({ ...base, count: 3 });
        expect(
            items.map(i => [
                i.index,
                i.description,
                i.amount,
                iso(i.issueDate),
                iso(i.expirationDate),
            ]),
        ).toEqual([
            [1, 'Aluguel (nov/2026)', 250000, '2026-11-05', '2026-11-10'],
            [2, 'Aluguel (dez/2026)', 250000, '2026-12-05', '2026-12-10'],
            [3, 'Aluguel (jan/2027)', 250000, '2027-01-05', '2027-01-10'],
        ]);
    });

    it('por data final: inclui as ocorrências com vencimento até a data (inclusive)', () => {
        const items = buildRecurrences({ ...base, until: day('2027-01-10') });
        expect(items.map(i => iso(i.expirationDate))).toEqual([
            '2026-11-10',
            '2026-12-10',
            '2027-01-10',
        ]);
        expect(buildRecurrences({ ...base, until: day('2027-01-09') })).toHaveLength(2);
    });

    it('ao estender, continua a numeração e ancora nas datas da primeira ocorrência', () => {
        const items = buildRecurrences({ ...base, count: 2, startIndex: 4 });
        expect(items.map(i => [i.index, i.description, iso(i.expirationDate)])).toEqual([
            [4, 'Aluguel (fev/2027)', '2027-02-10'],
            [5, 'Aluguel (mar/2027)', '2027-03-10'],
        ]);
    });

    it.each([
        ['sem fim', {}],
        ['count e until juntos', { count: 2, until: day('2027-01-10') }],
        ['count zero', { count: 0 }],
        ['count fracionado', { count: 1.5 }],
        ['until antes da primeira ocorrência', { until: day('2026-11-09') }],
    ])('rejeita %s com SERIES_INVALID', (_label, overrides) => {
        expect(() => buildRecurrences({ ...base, ...overrides })).toThrow(code('SERIES_INVALID'));
    });

    it('rejeita mais de 60 por geração e mais de 120 por série com SERIES_LIMIT_EXCEEDED', () => {
        expect(() => buildRecurrences({ ...base, count: 61 })).toThrow(
            code('SERIES_LIMIT_EXCEEDED'),
        );
        expect(buildRecurrences({ ...base, count: 60 })).toHaveLength(60);
        expect(() => buildRecurrences({ ...base, count: 60, startIndex: 62 })).toThrow(
            code('SERIES_LIMIT_EXCEEDED'),
        );
        expect(buildRecurrences({ ...base, count: 60, startIndex: 61 })).toHaveLength(60);
        expect(MAX_PER_SERIES).toBe(120);
        expect(() =>
            buildRecurrences({
                ...base,
                frequency: SeriesFrequency.WEEKLY,
                until: day('2030-01-01'),
            }),
        ).toThrow(code('SERIES_LIMIT_EXCEEDED'));
    });
});
