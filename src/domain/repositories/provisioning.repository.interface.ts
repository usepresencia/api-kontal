import type { MembershipRole } from '@/domain/auth/membership-role.js';

export interface ProvisioningRecord {
    /** Identificador do evento, definido por quem pede (chave de idempotência). */
    id: string;
    action: 'GRANT' | 'REVOKE';
    status: 'DONE' | 'FAILED';
    email: string;
    companyId: string;
    role: MembershipRole | null;
    error: string | null;
}

export interface IProvisioningRepository {
    findById(id: string): Promise<ProvisioningRecord | null>;
    /** Grava o registro, substituindo o anterior de mesmo `id`. */
    save(record: ProvisioningRecord): Promise<void>;
}
