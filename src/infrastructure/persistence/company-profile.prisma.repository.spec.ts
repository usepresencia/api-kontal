import { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import { CompanyProfilePrismaRepository } from '@/infrastructure/persistence/company-profile.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const profile = CompanyProfileEntity.create({
    id: 'c1',
    name: 'Padaria',
    socialReason: 'Padaria LTDA',
    cnpj: '11.222.333/0001-81',
    openingDate: new Date('2020-05-01T00:00:00.000Z'),
    cnae: '1091-1/02',
    taxRegime: 'Simples Nacional',
    email: 'contato@padaria.com',
    phone: '11999990000',
    address: {
        zipCode: '01310100',
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
    },
});

const row = {
    id: 'c1',
    name: 'Padaria',
    socialReason: 'Padaria LTDA',
    cnpj: '11222333000181',
    openingDate: new Date('2020-05-01T00:00:00.000Z'),
    cnae: '1091-1/02',
    taxRegime: 'Simples Nacional',
    email: 'contato@padaria.com',
    phone: '11999990000',
    logoUrl: null,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    address: {
        id: 'a1',
        companyId: 'c1',
        zipCode: '01310100',
        street: 'Av. Paulista',
        number: '1000',
        complement: null,
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
    },
};

const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

function makePrisma() {
    const company = {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
    };
    const prisma = {
        company,
        $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    return {
        prisma,
        company,
        repo: new CompanyProfilePrismaRepository(prisma as unknown as PrismaService),
    };
}

describe('CompanyProfilePrismaRepository.create', () => {
    it('grava a empresa com o endereço aninhado', async () => {
        const { repo, company } = makePrisma();
        company.create.mockResolvedValue(row);
        await repo.create(profile);
        expect(company.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id: 'c1',
                cnpj: '11222333000181',
                isActive: true,
                logoUrl: null,
                address: { create: expect.objectContaining({ zipCode: '01310100', state: 'SP' }) },
            }),
        });
    });

    it('CNPJ duplicado (P2002) vira DomainError CNPJ_ALREADY_REGISTERED', async () => {
        const { repo, company } = makePrisma();
        company.create.mockRejectedValue(p2002);
        await expect(repo.create(profile)).rejects.toMatchObject({
            code: 'CNPJ_ALREADY_REGISTERED',
        });
    });

    it('propaga erro que não é P2002', async () => {
        const { repo, company } = makePrisma();
        const boom = new Error('db down');
        company.create.mockRejectedValue(boom);
        await expect(repo.create(profile)).rejects.toBe(boom);
    });
});

describe('CompanyProfilePrismaRepository.update', () => {
    it('atualiza a empresa e o endereço pelo id', async () => {
        const { repo, company } = makePrisma();
        company.update.mockResolvedValue(row);
        await repo.update(profile.withLogo('https://x/logo.png'));
        expect(company.update).toHaveBeenCalledWith({
            where: { id: 'c1' },
            data: expect.objectContaining({
                logoUrl: 'https://x/logo.png',
                address: { update: expect.objectContaining({ city: 'São Paulo' }) },
            }),
        });
    });

    it('CNPJ duplicado (P2002) vira DomainError CNPJ_ALREADY_REGISTERED', async () => {
        const { repo, company } = makePrisma();
        company.update.mockRejectedValue(p2002);
        await expect(repo.update(profile)).rejects.toMatchObject({
            code: 'CNPJ_ALREADY_REGISTERED',
        });
    });
});

describe('CompanyProfilePrismaRepository.findById', () => {
    it('devolve null quando não existe', async () => {
        const { repo, company } = makePrisma();
        company.findUnique.mockResolvedValue(null);
        await expect(repo.findById('x')).resolves.toBeNull();
    });

    it('lê a empresa com o endereço em uma consulta (join)', async () => {
        const { repo, company } = makePrisma();
        company.findUnique.mockResolvedValue(row);
        const result = await repo.findById('c1');
        expect(result?.cnpj).toBe('11222333000181');
        expect(result?.address.city).toBe('São Paulo');
        expect(company.findUnique).toHaveBeenCalledWith({
            where: { id: 'c1' },
            include: { address: true },
            relationLoadStrategy: 'join',
        });
    });

    it('falha quando a empresa não tem endereço cadastrado', async () => {
        const { repo, company } = makePrisma();
        company.findUnique.mockResolvedValue({ ...row, address: null });
        await expect(repo.findById('c1')).rejects.toThrow(/sem endereço/);
    });
});

describe('CompanyProfilePrismaRepository.list', () => {
    it('pagina com findMany e count na mesma transação', async () => {
        const { repo, company, prisma } = makePrisma();
        company.findMany.mockResolvedValue([row]);
        company.count.mockResolvedValue(11);
        const page = await repo.list({ page: 2, pageSize: 5 });
        expect(prisma.$transaction).toHaveBeenCalledOnce();
        expect(company.findMany).toHaveBeenCalledWith({
            orderBy: { name: 'asc' },
            skip: 5,
            take: 5,
            include: { address: true },
            relationLoadStrategy: 'join',
        });
        expect(page).toMatchObject({ page: 2, pageSize: 5, total: 11 });
        expect(page.items).toHaveLength(1);
    });
});
