import { CompanyEntity } from '@/domain/entities/company.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

describe('CompanyEntity', () => {
    it('cria ativa por padrão e apara o nome', () => {
        const company = CompanyEntity.create({ id: 'c1', name: '  Padaria Pão Quente ' });
        expect(company.name).toBe('Padaria Pão Quente');
        expect(company.isActive).toBe(true);
    });

    it('rejeita nome vazio', () => {
        expect(() => CompanyEntity.create({ id: 'c1', name: '   ' })).toThrow(DomainError);
    });
});
