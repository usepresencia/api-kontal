import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
    type CompanyData,
    CompanyProfileEntity,
} from '@/domain/entities/company-profile.entity.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { COMPANY_PROFILE_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class CreateCompanyService {
    constructor(
        @Inject(COMPANY_PROFILE_REPOSITORY) private readonly companies: ICompanyProfileRepository,
    ) {}

    /** Cria e persiste uma empresa nova com o endereço. */
    async execute(data: CompanyData): Promise<CompanyProfileEntity> {
        const profile = CompanyProfileEntity.create({ id: randomUUID(), ...data });
        await this.companies.create(profile);
        return profile;
    }
}
