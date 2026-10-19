import type { Prisma } from '@prisma/client';
import { TitleEntity } from '@/domain/entities/title.entity.js';
import { TitleTxRepository } from '@/infrastructure/persistence/ledger/title.tx.repository.js';

const dec = (text: string) => ({ toFixed: () => text });
const day = new Date('2026-10-14T00:00:00.000Z');
const row = {
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
    amount: dec('100.00'),
    settledAmount: dec('0.00'),
    issueDate: day,
    expirationDate: day,
    feesPercentageMonthly: dec('0.00'),
    createdAt: day,
    updatedAt: day,
};
const title = TitleEntity.fromPersistence({
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
    amount: 10000,
    settledAmount: 0,
    issueDate: day,
    expirationDate: day,
    feesPercentageMonthly: 0,
    createdAt: day,
});

function makeRepo() {
    const client = {
        $queryRaw: vi.fn(),
        title: {
            findUniqueOrThrow: vi.fn(),
            createMany: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
        },
        entry: { count: vi.fn(), findMany: vi.fn() },
    };
    return { client, repo: new TitleTxRepository(client as unknown as Prisma.TransactionClient) };
}

describe('TitleTxRepository.lock', () => {
    it('trava a linha do título da empresa com FOR UPDATE e devolve a entidade', async () => {
        const { repo, client } = makeRepo();
        client.$queryRaw.mockResolvedValue([{ id: 't1' }]);
        client.title.findUniqueOrThrow.mockResolvedValue(row);
        const found = await repo.lock('c1', 't1');
        const [strings, ...values] = client.$queryRaw.mock.calls[0];
        expect(strings.join('?')).toContain('FOR UPDATE');
        expect(strings.join('?')).toContain('"companyId"');
        expect(values).toEqual(['t1', 'c1']);
        expect(found).toMatchObject({ id: 't1', amount: 10000 });
    });

    it('título de outra empresa ou inexistente devolve null sem ler a linha', async () => {
        const { repo, client } = makeRepo();
        client.$queryRaw.mockResolvedValue([]);
        await expect(repo.lock('c1', 'x')).resolves.toBeNull();
        expect(client.title.findUniqueOrThrow).not.toHaveBeenCalled();
    });
});

describe('TitleTxRepository: escrita', () => {
    it('insertAll grava em lote e lista vazia não toca o banco', async () => {
        const { repo, client } = makeRepo();
        await repo.insertAll([title, title]);
        expect(client.title.createMany.mock.calls[0][0].data).toHaveLength(2);
        client.title.createMany.mockClear();
        await repo.insertAll([]);
        expect(client.title.createMany).not.toHaveBeenCalled();
    });

    it('save atualiza só as colunas mutáveis pelo id', async () => {
        const { repo, client } = makeRepo();
        await repo.save(title.applyPayment(4000));
        const call = client.title.update.mock.calls[0][0];
        expect(call.where).toEqual({ id: 't1' });
        expect(call.data.settledAmount.toFixed(2)).toBe('40.00');
        expect(call.data.status).toBe('OPEN');
    });

    it('deleteAll remove pelos ids e lista vazia não toca o banco', async () => {
        const { repo, client } = makeRepo();
        await repo.deleteAll(['t1', 't2']);
        expect(client.title.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ['t1', 't2'] } },
        });
        client.title.deleteMany.mockClear();
        await repo.deleteAll([]);
        expect(client.title.deleteMany).not.toHaveBeenCalled();
    });
});

describe('TitleTxRepository: baixas do título', () => {
    it('countEntries conta as baixas do título', async () => {
        const { repo, client } = makeRepo();
        client.entry.count.mockResolvedValue(3);
        await expect(repo.countEntries('t1')).resolves.toBe(3);
        expect(client.entry.count).toHaveBeenCalledWith({ where: { titleId: 't1' } });
    });

    it('idsWithEntries devolve os títulos que têm baixas, em uma consulta', async () => {
        const { repo, client } = makeRepo();
        client.entry.findMany.mockResolvedValue([{ titleId: 't2' }]);
        await expect(repo.idsWithEntries(['t1', 't2'])).resolves.toEqual(new Set(['t2']));
        expect(client.entry.findMany).toHaveBeenCalledWith({
            where: { titleId: { in: ['t1', 't2'] } },
            select: { titleId: true },
            distinct: ['titleId'],
        });
    });

    it('idsWithEntries sem ids não consulta', async () => {
        const { repo, client } = makeRepo();
        await expect(repo.idsWithEntries([])).resolves.toEqual(new Set());
        expect(client.entry.findMany).not.toHaveBeenCalled();
    });
});
