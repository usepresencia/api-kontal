import { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountRef } from '@/domain/billing/account-ref.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { EntryEntity, type EntryRow } from '@/domain/entities/entry.entity.js';
import { JournalEntryEntity, type JournalLine } from '@/domain/entities/journal-entry.entity.js';
import { PresetEntity } from '@/domain/entities/preset.entity.js';
import { TitleEntity, type TitleRow } from '@/domain/entities/title.entity.js';
import type { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type {
    IJournalReadRepository,
    JournalView,
} from '@/domain/repositories/journal-read.repository.interface.js';
import type { IEntryReadRepository } from '@/domain/repositories/entry-read.repository.interface.js';
import type {
    ILedgerTx,
    ILedgerUnitOfWork,
} from '@/domain/repositories/ledger.unit-of-work.interface.js';
import type { IPresetRepository } from '@/domain/repositories/preset.repository.interface.js';
import type { ISeriesReadRepository } from '@/domain/repositories/series-read.repository.interface.js';
import type { ITitleReadRepository } from '@/domain/repositories/title-read.repository.interface.js';

export const TODAY = new Date('2026-10-14T00:00:00.000Z');
export const fakeClock = { today: () => TODAY };

export function fakePresetRepo() {
    return {
        create: vi.fn(),
        findById: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        isInUse: vi.fn(),
        delete: vi.fn(),
    } satisfies IPresetRepository;
}

export function fakeTitleRead() {
    return { find: vi.fn(), list: vi.fn() } satisfies ITitleReadRepository;
}

export function fakeEntryRead() {
    return { find: vi.fn(), list: vi.fn() } satisfies IEntryReadRepository;
}

export function fakeSeriesRead() {
    return { find: vi.fn(), list: vi.fn() } satisfies ISeriesReadRepository;
}

export function fakeTx() {
    return {
        journal: { find: vi.fn(), findAll: vi.fn(), writeAll: vi.fn(), lock: vi.fn() },
        presets: { find: vi.fn() },
        accounts: { findRefs: vi.fn(), controlAccountIds: vi.fn() },
        titles: {
            lock: vi.fn(),
            insertAll: vi.fn(),
            save: vi.fn(),
            deleteAll: vi.fn(),
            countEntries: vi.fn(),
            idsWithEntries: vi.fn(),
        },
        entries: {
            find: vi.fn(),
            insert: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
            hasWriteOff: vi.fn(),
        },
        series: {
            insert: vi.fn(),
            lock: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
            titles: vi.fn(),
            lastTitle: vi.fn(),
        },
    } satisfies ILedgerTx;
}

/** Unidade de trabalho falsa que executa a função direto sobre o `tx` falso. */
export function fakeUow(tx = fakeTx()) {
    const uow = {
        run: vi.fn((fn: (t: ILedgerTx) => Promise<unknown>) => fn(tx)),
    } as unknown as ILedgerUnitOfWork;
    return { uow, tx };
}

export const presetFixture = PresetEntity.create({
    id: 'pr1',
    billingPlanId: 'p1',
    name: 'Venda de serviços',
    accounts: {
        receivable: 'ar',
        payable: 'ap',
        revenue: 'rev',
        expense: 'exp',
        interestIncome: 'jr',
        discountGranted: 'dc',
        badDebt: 'pd',
        interestExpense: 'jp',
        discountObtained: 'do',
        debtForgiveness: 'pf',
    },
});

export const bankRef: AccountRef = {
    id: 'bank',
    billingPlanId: 'p1',
    accountType: AccountType.ANALYTIC,
    nature: AccountNature.ASSET,
    isActive: true,
};

export function titleFixture(overrides: Partial<TitleRow> = {}): TitleEntity {
    return TitleEntity.fromPersistence({
        id: 't1',
        companyId: 'c1',
        presetId: 'pr1',
        controlAccountId: 'ar',
        resultAccountId: 'rev',
        seriesId: null,
        seriesIndex: null,
        type: 'INCOME',
        status: 'OPEN',
        description: 'Venda',
        amount: 100000,
        settledAmount: 0,
        issueDate: new Date('2026-10-01T00:00:00.000Z'),
        expirationDate: new Date('2026-11-01T00:00:00.000Z'),
        feesPercentageMonthly: 0,
        isOpening: false,
        openingDate: null,
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        ...overrides,
    });
}

export function entryFixture(overrides: Partial<EntryRow> = {}): EntryEntity {
    return EntryEntity.fromPersistence({
        id: 'e1',
        titleId: 't1',
        kind: 'PAYMENT',
        billingAccountId: 'bank',
        principalAmount: 30000,
        interestAmount: 0,
        fineAmount: 0,
        discountAmount: 0,
        totalAmount: 30000,
        paidAt: new Date('2026-10-10T00:00:00.000Z'),
        paymentMethod: 'PIX',
        description: '',
        createdAt: new Date('2026-10-10T00:00:00.000Z'),
        ...overrides,
    });
}

export function journalFixture(
    referenceType: JournalRefType,
    referenceId: string,
    lines: JournalLine[],
    date = new Date('2026-10-01T00:00:00.000Z'),
): JournalEntryEntity {
    return JournalEntryEntity.create({
        id: `j-${referenceId}`,
        companyId: 'c1',
        date,
        description: 'original',
        referenceType,
        referenceId,
        lines,
    });
}

export function fakeJournalRead() {
    return { find: vi.fn(), list: vi.fn() } satisfies IJournalReadRepository;
}

/** Visão de leitura do lançamento: código e nome das contas = id da conta. */
export function journalViewFixture(
    entry: JournalEntryEntity,
    overrides: Partial<Omit<JournalView, 'entry'>> = {},
): JournalView {
    return {
        entry,
        number: 1,
        accounts: Object.fromEntries(
            entry.lines.map(line => [
                line.accountId,
                { code: line.accountId, name: line.accountId },
            ]),
        ),
        reversedBy: null,
        ...overrides,
    };
}
