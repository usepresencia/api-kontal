import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type {
    IPartyRepository,
    PartyView,
} from '@/domain/repositories/party.repository.interface.js';

/**
 * Devolve a contraparte do tenant.
 * @throws DomainError PARTY_NOT_FOUND
 */
export async function requireParty(
    parties: IPartyRepository,
    companyId: string,
    id: string,
): Promise<PartyView> {
    const view = await parties.findById(companyId, id);
    if (!view) throw new DomainError(ErrorCode.PARTY_NOT_FOUND, 'Contraparte não encontrada');
    return view;
}
