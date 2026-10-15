import {
    assertLockedFieldsUnchanged,
    TitleEntity,
    TitleStatus,
} from '@/domain/entities/title.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { TitleType } from '@/domain/ledger/title-type.js';

const today = new Date('2026-10-14T00:00:00.000Z');
const due = new Date('2026-11-05T00:00:00.000Z');

const create = (overrides: Record<string, unknown> = {}) =>
    TitleEntity.create({
        id: 't1',
        companyId: 'c1',
        presetId: 'pr1',
        accounts: { controlAccountId: 'ar', resultAccountId: 'rev' },
        type: TitleType.INCOME,
        description: ' Venda ',
        amount: 100000,
        today,
        expirationDate: due,
        ...overrides,
    });
const code = (value: string) => expect.objectContaining({ code: value });

describe('TitleEntity.create', () => {
    it('apara a descrição, assume emissão hoje, juros zero e começa em aberto', () => {
        const title = create();
        expect(title).toMatchObject({
            id: 't1',
            companyId: 'c1',
            presetId: 'pr1',
            controlAccountId: 'ar',
            resultAccountId: 'rev',
            seriesId: null,
            seriesIndex: null,
            type: 'INCOME',
            status: TitleStatus.OPEN,
            description: 'Venda',
            amount: 100000,
            settledAmount: 0,
            feesPercentageMonthly: 0,
            issueDate: today,
            expirationDate: due,
        });
        expect(title.remainingAmount).toBe(100000);
    });

    it('respeita emissão, juros e série informados', () => {
        const issueDate = new Date('2026-10-01T00:00:00.000Z');
        const title = create({
            issueDate,
            feesPercentageMonthly: 0.05,
            seriesId: 's1',
            seriesIndex: 2,
        });
        expect(title).toMatchObject({
            issueDate,
            feesPercentageMonthly: 0.05,
            seriesId: 's1',
            seriesIndex: 2,
        });
    });

    it.each([
        ['valor zero', { amount: 0 }],
        ['valor negativo', { amount: -1 }],
        ['valor fracionado', { amount: 10.5 }],
        ['valor acima do limite', { amount: 1_000_000_000_000 }],
        ['descrição vazia', { description: ' ' }],
        ['descrição acima de 255', { description: 'x'.repeat(256) }],
        ['juros negativos', { feesPercentageMonthly: -0.01 }],
        ['juros acima de 1', { feesPercentageMonthly: 1.01 }],
        ['vencimento inválido', { expirationDate: new Date('invalid') }],
    ])('rejeita %s', (_label, overrides) => {
        expect(() => create(overrides)).toThrow(DomainError);
    });
});

describe('TitleEntity: baixas', () => {
    it('pagamento parcial abate o saldo e mantém em aberto', () => {
        const title = create().applyPayment(30000);
        expect(title).toMatchObject({ settledAmount: 30000, status: TitleStatus.OPEN });
        expect(title.remainingAmount).toBe(70000);
    });

    it('pagamento do saldo inteiro quita o título', () => {
        const title = create().applyPayment(30000).applyPayment(70000);
        expect(title).toMatchObject({ settledAmount: 100000, status: TitleStatus.SETTLED });
        expect(title.remainingAmount).toBe(0);
    });

    it('pagamento acima do saldo responde ENTRY_EXCEEDS_BALANCE', () => {
        expect(() => create().applyPayment(30000).applyPayment(70001)).toThrow(
            code('ENTRY_EXCEEDS_BALANCE'),
        );
    });

    it.each([
        ['quitado', () => create().applyPayment(100000)],
        ['baixado por perda', () => create().applyWriteOff()],
    ])('título %s não recebe pagamento nem perda (TITLE_NOT_OPEN)', (_label, make) => {
        expect(() => make().applyPayment(1)).toThrow(code('TITLE_NOT_OPEN'));
        expect(() => make().applyWriteOff()).toThrow(code('TITLE_NOT_OPEN'));
    });

    it('perda encerra o saldo e marca como baixado por perda', () => {
        const title = create().applyPayment(30000).applyWriteOff();
        expect(title).toMatchObject({ settledAmount: 100000, status: TitleStatus.WRITTEN_OFF });
        expect(title.remainingAmount).toBe(0);
    });

    it('estornar um pagamento reabre o título', () => {
        const title = create().applyPayment(100000).revertSettlement(40000);
        expect(title).toMatchObject({ settledAmount: 60000, status: TitleStatus.OPEN });
    });

    it('estornar a perda reabre o título com o saldo anterior', () => {
        const title = create().applyPayment(30000).applyWriteOff().revertSettlement(70000);
        expect(title).toMatchObject({ settledAmount: 30000, status: TitleStatus.OPEN });
    });

    it('estornar mais do que foi abatido é erro interno', () => {
        expect(() => create().applyPayment(100).revertSettlement(101)).toThrow(
            code('INTERNAL_ERROR'),
        );
    });
});

describe('TitleEntity.withEdits', () => {
    it('altera descrição, vencimento e juros e preserva o resto', () => {
        const edited = create()
            .applyPayment(100)
            .withEdits({
                description: ' Novo ',
                expirationDate: new Date('2026-12-01T00:00:00.000Z'),
                feesPercentageMonthly: 0.1,
            });
        expect(edited).toMatchObject({
            description: 'Novo',
            expirationDate: new Date('2026-12-01T00:00:00.000Z'),
            feesPercentageMonthly: 0.1,
            amount: 100000,
            settledAmount: 100,
            type: 'INCOME',
        });
    });

    it('sem campos mantém tudo e revalida o que vier', () => {
        expect(create().withEdits({}).description).toBe('Venda');
        expect(() => create().withEdits({ description: '' })).toThrow(DomainError);
        expect(() => create().withEdits({ feesPercentageMonthly: 2 })).toThrow(DomainError);
    });
});

describe('assertLockedFieldsUnchanged', () => {
    const title = create();

    it('aceita campos iguais aos atuais ou ausentes', () => {
        expect(() => assertLockedFieldsUnchanged(title, {})).not.toThrow();
        expect(() =>
            assertLockedFieldsUnchanged(title, {
                type: 'INCOME',
                amount: 100000,
                presetId: 'pr1',
                issueDate: today,
            }),
        ).not.toThrow();
    });

    it.each([
        ['tipo', { type: 'EXPENSE' as const }],
        ['valor', { amount: 99999 }],
        ['preset', { presetId: 'outro' }],
        ['emissão', { issueDate: new Date('2026-10-01T00:00:00.000Z') }],
    ])('alterar %s responde TITLE_FIELD_LOCKED', (_label, input) => {
        expect(() => assertLockedFieldsUnchanged(title, input)).toThrow(code('TITLE_FIELD_LOCKED'));
    });
});

describe('TitleEntity.fromPersistence', () => {
    it('reidrata sem revalidar', () => {
        const createdAt = new Date('2026-01-01');
        const title = TitleEntity.fromPersistence({
            id: 't9',
            companyId: 'c9',
            presetId: 'p9',
            controlAccountId: 'ar',
            resultAccountId: 'rev',
            seriesId: null,
            seriesIndex: null,
            type: TitleType.EXPENSE,
            status: TitleStatus.SETTLED,
            description: 'x',
            amount: 500,
            settledAmount: 500,
            issueDate: today,
            expirationDate: due,
            feesPercentageMonthly: 0,
            createdAt,
        });
        expect(title.createdAt).toBe(createdAt);
        expect(title.status).toBe('SETTLED');
    });
});
