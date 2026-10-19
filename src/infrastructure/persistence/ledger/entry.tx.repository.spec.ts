import type { Prisma } from '@prisma/client';
import { EntryEntity, PaymentMethod } from '@/domain/entities/entry.entity.js';
import { EntryTxRepository } from '@/infrastructure/persistence/ledger/entry.tx.repository.js';

const dec = (text: string) => ({ toFixed: () => text });
const day = new Date('2026-10-10T00:00:00.000Z');
const row = {
    id: 'e1',
    titleId: 't1',
    kind: 'PAYMENT',
    billingAccountId: 'bank',
    principalAmount: dec('100.00'),
    interestAmount: dec('0.00'),
    fineAmount: dec('0.00'),
    discountAmount: dec('0.00'),
    totalAmount: dec('100.00'),
    paidAt: day,
    paymentMethod: 'PIX',
    description: '',
    createdAt: day,
    updatedAt: day,
};
const entry = EntryEntity.payment({
    id: 'e1',
    titleId: 't1',
    billingAccountId: 'bank',
    principal: 10000,
    paidAt: day,
    paymentMethod: PaymentMethod.PIX,
    issueDate: day,
    today: day,
});

function makeRepo() {
    const client = {
        entry: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
        },
    };
    return { client, repo: new EntryTxRepository(client as unknown as Prisma.TransactionClient) };
}

describe('EntryTxRepository', () => {
    it('find escopa pela empresa do título e devolve null quando não acha', async () => {
        const { repo, client } = makeRepo();
        client.entry.findFirst.mockResolvedValue(null);
        await expect(repo.find('c1', 'e1')).resolves.toBeNull();
        expect(client.entry.findFirst).toHaveBeenCalledWith({
            where: { id: 'e1', title: { companyId: 'c1' } },
        });
        client.entry.findFirst.mockResolvedValue(row);
        await expect(repo.find('c1', 'e1')).resolves.toMatchObject({
            id: 'e1',
            principalAmount: 10000,
        });
    });

    it('insert grava a baixa', async () => {
        const { repo, client } = makeRepo();
        await repo.insert(entry);
        expect(client.entry.create.mock.calls[0][0].data).toMatchObject({
            id: 'e1',
            titleId: 't1',
            kind: 'PAYMENT',
        });
    });

    it('save atualiza descrição e forma de pagamento pelo id', async () => {
        const { repo, client } = makeRepo();
        await repo.save(
            entry.withChanges({ description: 'novo', paymentMethod: PaymentMethod.CASH }),
        );
        expect(client.entry.update).toHaveBeenCalledWith({
            where: { id: 'e1' },
            data: { description: 'novo', paymentMethod: 'CASH' },
        });
    });

    it('delete remove pelo id', async () => {
        const { repo, client } = makeRepo();
        await repo.delete('e1');
        expect(client.entry.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });

    it('hasWriteOff verifica se o título tem baixa por perda', async () => {
        const { repo, client } = makeRepo();
        client.entry.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
        await expect(repo.hasWriteOff('t1')).resolves.toBe(true);
        await expect(repo.hasWriteOff('t1')).resolves.toBe(false);
        expect(client.entry.count).toHaveBeenCalledWith({
            where: { titleId: 't1', kind: 'WRITE_OFF' },
        });
    });
});
