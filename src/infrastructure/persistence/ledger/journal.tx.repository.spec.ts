import type { Prisma } from '@prisma/client';
import { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import { JournalTxRepository } from '@/infrastructure/persistence/ledger/journal.tx.repository.js';

const entry = (id: string, referenceId: string) =>
    JournalEntryEntity.create({
        id,
        companyId: 'c1',
        date: new Date('2026-10-14T00:00:00.000Z'),
        description: 'd',
        referenceType: 'SETTLEMENT',
        referenceId,
        lines: [
            { accountId: 'a', debit: 100, credit: 0, memo: '' },
            { accountId: 'b', debit: 0, credit: 100, memo: '' },
        ],
    });
const p2002 = Object.assign(new Error('dup'), { code: 'P2002' });

function makeRepo() {
    const client = {
        $queryRaw: vi.fn().mockResolvedValue([{ closedThrough: null }]),
        journalEntry: { findUnique: vi.fn(), createMany: vi.fn() },
        journalLine: { createMany: vi.fn() },
    };
    return { client, repo: new JournalTxRepository(client as unknown as Prisma.TransactionClient) };
}

describe('JournalTxRepository.find', () => {
    it('busca pela referência única, com as linhas, e devolve null quando não existe', async () => {
        const { repo, client } = makeRepo();
        client.journalEntry.findUnique.mockResolvedValue(null);
        await expect(repo.find('SETTLEMENT', 'e1')).resolves.toBeNull();
        expect(client.journalEntry.findUnique).toHaveBeenCalledWith({
            where: {
                referenceType_referenceId: { referenceType: 'SETTLEMENT', referenceId: 'e1' },
            },
            include: { lines: true },
        });
    });

    it('reidrata o lançamento encontrado', async () => {
        const { repo, client } = makeRepo();
        client.journalEntry.findUnique.mockResolvedValue({
            id: 'j1',
            companyId: 'c1',
            date: new Date('2026-10-14T00:00:00.000Z'),
            description: 'd',
            referenceType: 'SETTLEMENT',
            referenceId: 'e1',
            totalDebits: { toFixed: () => '1.00' },
            totalCredits: { toFixed: () => '1.00' },
            createdAt: new Date('2026-01-01'),
            lines: [
                {
                    accountId: 'a',
                    debit: { toFixed: () => '1.00' },
                    credit: { toFixed: () => '0.00' },
                    memo: '',
                },
                {
                    accountId: 'b',
                    debit: { toFixed: () => '0.00' },
                    credit: { toFixed: () => '1.00' },
                    memo: '',
                },
            ],
        });
        await expect(repo.find('SETTLEMENT', 'e1')).resolves.toMatchObject({
            id: 'j1',
            totalDebits: 100,
        });
    });
});

describe('JournalTxRepository.findAll', () => {
    it('busca todos os lançamentos do tipo para os eventos em uma consulta', async () => {
        const { repo, client } = makeRepo();
        client.journalEntry.findMany = vi.fn().mockResolvedValue([]);
        await expect(repo.findAll('TITLE_CREATION', ['t1', 't2'])).resolves.toEqual([]);
        expect(client.journalEntry.findMany).toHaveBeenCalledWith({
            where: { referenceType: 'TITLE_CREATION', referenceId: { in: ['t1', 't2'] } },
            include: { lines: true },
        });
    });

    it('sem ids não consulta o banco', async () => {
        const { repo, client } = makeRepo();
        client.journalEntry.findMany = vi.fn();
        await expect(repo.findAll('TITLE_CREATION', [])).resolves.toEqual([]);
        expect(client.journalEntry.findMany).not.toHaveBeenCalled();
    });
});

describe('JournalTxRepository.writeAll', () => {
    it('grava lançamentos e linhas em lote (2 comandos, independente da quantidade)', async () => {
        const { repo, client } = makeRepo();
        await repo.writeAll([entry('j1', 'e1'), entry('j2', 'e2'), entry('j3', 'e3')]);
        expect(client.journalEntry.createMany).toHaveBeenCalledTimes(1);
        expect(client.journalLine.createMany).toHaveBeenCalledTimes(1);
        expect(client.journalEntry.createMany.mock.calls[0][0].data).toHaveLength(3);
        expect(client.journalLine.createMany.mock.calls[0][0].data).toHaveLength(6);
    });

    it('lista vazia não toca o banco', async () => {
        const { repo, client } = makeRepo();
        await repo.writeAll([]);
        expect(client.journalEntry.createMany).not.toHaveBeenCalled();
    });

    it('referência repetida (P2002) vira DomainError CONFLICT', async () => {
        const { repo, client } = makeRepo();
        client.journalEntry.createMany.mockRejectedValue(p2002);
        await expect(repo.writeAll([entry('j1', 'e1')])).rejects.toMatchObject({
            code: 'CONFLICT',
        });
    });

    it('propaga erro que não é P2002', async () => {
        const { repo, client } = makeRepo();
        const boom = new Error('db down');
        client.journalEntry.createMany.mockRejectedValue(boom);
        await expect(repo.writeAll([entry('j1', 'e1')])).rejects.toBe(boom);
    });
});

describe('JournalTxRepository.lock', () => {
    it('trava o lançamento da empresa e o devolve; null se não é da empresa', async () => {
        const dec = (text: string) => ({ toFixed: () => text });
        const row = {
            id: 'j1',
            companyId: 'c1',
            date: new Date('2026-10-01T00:00:00.000Z'),
            description: 'd',
            referenceType: 'MANUAL',
            referenceId: 'j1',
            totalDebits: dec('1.00'),
            totalCredits: dec('1.00'),
            createdAt: new Date('2026-10-01T12:00:00.000Z'),
            lines: [
                { accountId: 'a', debit: dec('1.00'), credit: dec('0.00'), memo: '' },
                { accountId: 'b', debit: dec('0.00'), credit: dec('1.00'), memo: '' },
            ],
        };
        const client = {
            $queryRaw: vi
                .fn()
                .mockResolvedValueOnce([{ id: 'j1' }])
                .mockResolvedValueOnce([]),
            journalEntry: { findUniqueOrThrow: vi.fn().mockResolvedValue(row) },
        };
        const repo = new JournalTxRepository(client as never);
        expect((await repo.lock('c1', 'j1'))?.id).toBe('j1');
        const [strings, ...values] = client.$queryRaw.mock.calls[0];
        expect((strings as string[]).join('?')).toContain('FOR UPDATE');
        expect(values).toEqual(['j1', 'c1']);
        expect(client.journalEntry.findUniqueOrThrow).toHaveBeenCalledWith({
            where: { id: 'j1' },
            include: { lines: true },
        });
        await expect(repo.lock('c1', 'x')).resolves.toBeNull();
    });
});

describe('JournalTxRepository: trava de período', () => {
    const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
    const at = (
        referenceId: string,
        date: string,
        referenceType: 'MANUAL' | 'CLOSING' = 'MANUAL',
    ) =>
        JournalEntryEntity.create({
            id: `j-${referenceId}`,
            companyId: 'c1',
            date: day(date),
            description: 'd',
            referenceType,
            referenceId,
            lines: [
                { accountId: 'a', debit: 100, credit: 0, memo: '' },
                { accountId: 'b', debit: 0, credit: 100, memo: '' },
            ],
        });

    it('closedThrough lê a trava da empresa com FOR KEY SHARE', async () => {
        const { repo, client } = makeRepo();
        client.$queryRaw.mockResolvedValueOnce([{ closedThrough: day('2026-09-30') }]);
        await expect(repo.closedThrough('c1')).resolves.toEqual(day('2026-09-30'));
        const [strings, ...values] = client.$queryRaw.mock.calls[0];
        expect((strings as string[]).join('?')).toContain('FOR KEY SHARE');
        expect(values).toEqual(['c1']);
        client.$queryRaw.mockResolvedValueOnce([]);
        await expect(repo.closedThrough('c1')).resolves.toBeNull();
    });

    it('writeAll recusa data fechada antes de gravar qualquer coisa', async () => {
        const { repo, client } = makeRepo();
        client.$queryRaw.mockResolvedValue([{ closedThrough: day('2026-09-30') }]);
        await expect(
            repo.writeAll([at('a', '2026-10-01'), at('b', '2026-09-30')]),
        ).rejects.toMatchObject({ code: 'PERIOD_CLOSED' });
        expect(client.journalEntry.createMany).not.toHaveBeenCalled();
        expect(client.journalLine.createMany).not.toHaveBeenCalled();
    });

    it('writeAll grava datas abertas e a apuração em período fechado, esta sem consultar a trava', async () => {
        const { repo, client } = makeRepo();
        client.$queryRaw.mockResolvedValue([{ closedThrough: day('2026-09-30') }]);
        await repo.writeAll([at('a', '2026-10-01')]);
        expect(client.journalEntry.createMany).toHaveBeenCalledTimes(1);
        client.$queryRaw.mockClear();
        await repo.writeAll([at('closing', '2026-01-31', 'CLOSING')]);
        expect(client.$queryRaw).not.toHaveBeenCalled();
        expect(client.journalEntry.createMany).toHaveBeenCalledTimes(2);
    });
});

describe('JournalTxRepository.earliestDate', () => {
    it('devolve a data do lançamento mais antigo da empresa ou null', async () => {
        const { repo, client } = makeRepo();
        client.$queryRaw
            .mockResolvedValueOnce([{ date: new Date('2026-03-10T00:00:00.000Z') }])
            .mockResolvedValueOnce([{ date: null }]);
        await expect(repo.earliestDate('c1')).resolves.toEqual(
            new Date('2026-03-10T00:00:00.000Z'),
        );
        await expect(repo.earliestDate('c1')).resolves.toBeNull();
        expect((client.$queryRaw.mock.calls[0][0] as string[]).join('?')).toContain('MIN("date")');
    });
});
