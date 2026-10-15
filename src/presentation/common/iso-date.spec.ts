import { isoDateSchema, toIsoDate } from '@/presentation/common/iso-date.js';

describe('isoDateSchema', () => {
    it('converte YYYY-MM-DD em Date UTC à meia-noite', () => {
        expect(isoDateSchema.parse('2026-10-14')).toEqual(new Date('2026-10-14T00:00:00.000Z'));
    });

    it.each(['14/10/2026', '2026-13-45', '2026-10-14T10:00:00Z', '', 'abc', 20261014, null])(
        'rejeita %j',
        value => {
            expect(isoDateSchema.safeParse(value).success).toBe(false);
        },
    );
});

describe('toIsoDate', () => {
    it('devolve a data em YYYY-MM-DD', () => {
        expect(toIsoDate(new Date('2026-10-14T00:00:00.000Z'))).toBe('2026-10-14');
    });
});
