import { PartyEntity } from '@/domain/entities/party.entity.js';
import { PartyPrismaRepository } from '@/infrastructure/persistence/party.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const party = PartyEntity.create({
    id: 'pt1',
    companyId: 'c1',
    kind: 'SUPPLIER',
    name: 'Copel',
    socialReason: 'Companhia Paranaense de Energia',
    document: '11.222.333/0001-81',
    email: 'a@b.com',
    phone: '41',
    address: null,
    defaultPresetId: 'pr1',
});

const row = {
    id: 'pt1',
    companyId: 'c1',
    kind: 'SUPPLIER',
    name: 'Copel',
    socialReason: 'Companhia Paranaense de Energia',
    document: '11222333000181',
    email: 'a@b.com',
    phone: '41',
    zipCode: null,
    street: null,
    number: null,
    complement: null,
    neighborhood: null,
    city: null,
    state: null,
    isActive: true,
    defaultPresetId: 'pr1',
    createdAt: new Date('2026-01-01'),
    defaultPreset: { name: 'Energia elétrica' },
};

function makeRepo() {
    const partyModel = {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
    };
    const title = { count: vi.fn() };
    const prisma = {
        party: partyModel,
        title,
        $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    return {
        partyModel,
        title,
        repo: new PartyPrismaRepository(prisma as unknown as PrismaService),
    };
}

describe('PartyPrismaRepository', () => {
    it('findById escopa pelo tenant e devolve o nome do preset padrão', async () => {
        const { repo, partyModel } = makeRepo();
        partyModel.findFirst.mockResolvedValue(row);
        const view = await repo.findById('c1', 'pt1');
        expect(partyModel.findFirst.mock.calls[0][0].where).toEqual({ id: 'pt1', companyId: 'c1' });
        expect(view?.defaultPresetName).toBe('Energia elétrica');
        expect(view?.party.document).toBe('11222333000181');
    });

    it('findById de outro tenant devolve null', async () => {
        const { repo, partyModel } = makeRepo();
        partyModel.findFirst.mockResolvedValue(null);
        expect(await repo.findById('outro', 'pt1')).toBeNull();
    });

    it('list filtra por tipo, status e busca (nome, razão social e dígitos do documento)', async () => {
        const { repo, partyModel } = makeRepo();
        partyModel.findMany.mockResolvedValue([row]);
        partyModel.count.mockResolvedValue(1);
        const page = await repo.list(
            'c1',
            { kind: 'SUPPLIER', isActive: true, search: '11.222' },
            { page: 2, pageSize: 10 },
        );
        const args = partyModel.findMany.mock.calls[0][0];
        expect(args.where).toMatchObject({ companyId: 'c1', kind: 'SUPPLIER', isActive: true });
        expect(args.where.OR).toHaveLength(3);
        expect(args.skip).toBe(10);
        expect(page).toMatchObject({ page: 2, pageSize: 10, total: 1 });
    });

    it('documentTaken consulta o tenant e ignora o próprio id na edição', async () => {
        const { repo, partyModel } = makeRepo();
        partyModel.findFirst.mockResolvedValue({ id: 'x' });
        expect(await repo.documentTaken('c1', '11222333000181', 'pt1')).toBe(true);
        expect(partyModel.findFirst.mock.calls[0][0].where).toEqual({
            companyId: 'c1',
            document: '11222333000181',
            id: { not: 'pt1' },
        });
    });

    it('isInUse conta os títulos e presetInUse conta as contrapartes que usam o preset', async () => {
        const { repo, title, partyModel } = makeRepo();
        title.count.mockResolvedValue(1);
        partyModel.count.mockResolvedValue(0);
        expect(await repo.isInUse('pt1')).toBe(true);
        expect(await repo.presetInUse('pr1')).toBe(false);
    });

    it('create grava o endereço em colunas e delete escopa pelo tenant', async () => {
        const { repo, partyModel } = makeRepo();
        await repo.create(party);
        expect(partyModel.create.mock.calls[0][0].data).toMatchObject({
            id: 'pt1',
            document: '11222333000181',
            zipCode: null,
        });
        await repo.delete('c1', 'pt1');
        expect(partyModel.deleteMany).toHaveBeenCalledWith({
            where: { id: 'pt1', companyId: 'c1' },
        });
    });
});
