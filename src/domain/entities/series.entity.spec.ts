import { SeriesEntity } from '@/domain/entities/series.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { SeriesFrequency, SeriesKind } from '@/domain/series/series-schedule.js';

const create = (overrides: Record<string, unknown> = {}) =>
    SeriesEntity.create({
        id: 's1',
        companyId: 'c1',
        kind: SeriesKind.RECURRING,
        frequency: SeriesFrequency.MONTHLY,
        totalCount: 12,
        baseDescription: ' Aluguel ',
        firstIssueDate: new Date('2026-11-05T00:00:00.000Z'),
        firstExpirationDate: new Date('2026-11-10T00:00:00.000Z'),
        ...overrides,
    });

describe('SeriesEntity', () => {
    it('cria aparando a descrição base', () => {
        expect(create()).toMatchObject({
            id: 's1',
            companyId: 'c1',
            kind: 'RECURRING',
            totalCount: 12,
            baseDescription: 'Aluguel',
        });
    });

    it.each([
        ['descrição vazia', { baseDescription: ' ' }],
        ['quantidade zero', { totalCount: 0 }],
        ['quantidade fracionada', { totalCount: 1.5 }],
    ])('rejeita %s', (_label, overrides) => {
        expect(() => create(overrides)).toThrow(DomainError);
    });

    it('withTotalCount devolve a série com a nova quantidade', () => {
        expect(create().withTotalCount(24).totalCount).toBe(24);
    });

    it('só a recorrente pode ser estendida', () => {
        expect(() => create().assertExtendable()).not.toThrow();
        expect(() => create({ kind: SeriesKind.INSTALLMENT }).assertExtendable()).toThrow(
            expect.objectContaining({ code: 'SERIES_NOT_EXTENDABLE' }),
        );
    });

    it('fromPersistence reidrata sem revalidar', () => {
        const createdAt = new Date('2026-01-01');
        const series = SeriesEntity.fromPersistence({
            id: 's9',
            companyId: 'c9',
            kind: SeriesKind.INSTALLMENT,
            frequency: SeriesFrequency.YEARLY,
            totalCount: 3,
            baseDescription: 'x',
            firstIssueDate: createdAt,
            firstExpirationDate: createdAt,
            createdAt,
        });
        expect(series.createdAt).toBe(createdAt);
    });
});
