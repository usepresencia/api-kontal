import { resolveOpening } from '@/domain/ledger/title-opening.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = day('2026-10-14');
const ctx = { amount: 100000, issueDate: undefined as Date | undefined, today };
const invalid = (fn: () => unknown) => {
    expect(fn).toThrow(expect.objectContaining({ code: 'OPENING_TITLE_INVALID' }));
};

describe('resolveOpening', () => {
    it('título comum devolve null', () => {
        expect(resolveOpening({}, ctx)).toBeNull();
        expect(resolveOpening({ isOpening: false }, ctx)).toBeNull();
    });

    it('campos de implantação sem isOpening são recusados', () => {
        invalid(() => resolveOpening({ openingDate: day('2026-10-01') }, ctx));
        invalid(() => resolveOpening({ isOpening: false, settledAmount: 100 }, ctx));
    });

    it('implantação válida: data obrigatória, pago anterior opcional', () => {
        expect(resolveOpening({ isOpening: true, openingDate: day('2026-10-01') }, ctx)).toEqual({
            openingDate: day('2026-10-01'),
            settledAmount: 0,
        });
        expect(
            resolveOpening({ isOpening: true, openingDate: today, settledAmount: 99999 }, ctx),
        ).toEqual({
            openingDate: today,
            settledAmount: 99999,
        });
        expect(
            resolveOpening(
                { isOpening: true, openingDate: day('2026-10-01') },
                { ...ctx, issueDate: day('2026-10-01') },
            ),
        ).not.toBeNull();
    });

    it.each([
        ['sem data', { isOpening: true }],
        ['data futura', { isOpening: true, openingDate: day('2026-10-15') }],
        ['data inválida', { isOpening: true, openingDate: new Date('x') }],
        [
            'pago igual ao valor',
            { isOpening: true, openingDate: day('2026-10-01'), settledAmount: 100000 },
        ],
        [
            'pago maior que o valor',
            { isOpening: true, openingDate: day('2026-10-01'), settledAmount: 100001 },
        ],
        ['pago negativo', { isOpening: true, openingDate: day('2026-10-01'), settledAmount: -1 }],
    ])('recusa %s', (_label, input) => {
        invalid(() => resolveOpening(input, ctx));
    });

    it('emissão depois da implantação é recusada', () => {
        invalid(() =>
            resolveOpening(
                { isOpening: true, openingDate: day('2026-10-01') },
                { ...ctx, issueDate: day('2026-10-02') },
            ),
        );
    });
});
