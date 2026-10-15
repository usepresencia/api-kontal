import { SystemClock } from '@/infrastructure/time/system-clock.js';

afterEach(() => {
    vi.useRealTimers();
});

describe('SystemClock.today', () => {
    it('usa o dia de São Paulo (23:30 do dia 14 ainda é dia 14)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-15T02:30:00.000Z'));
        expect(new SystemClock().today()).toEqual(new Date('2026-10-14T00:00:00.000Z'));
    });

    it('vira o dia à meia-noite de São Paulo', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-15T03:00:00.000Z'));
        expect(new SystemClock().today()).toEqual(new Date('2026-10-15T00:00:00.000Z'));
    });
});
