/** Papel de um usuário dentro de uma empresa. */
export const MembershipRole = {
    OWNER: 'OWNER',
    OPERATIONAL: 'OPERATIONAL',
    ACCOUNTANT: 'ACCOUNTANT',
    SUPPORT: 'SUPPORT',
} as const;

export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];
