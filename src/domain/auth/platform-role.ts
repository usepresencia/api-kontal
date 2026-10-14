/** Papel de plataforma, vindo da claim `platformRole` do Firebase. */
export const PlatformRole = {
    INTERNAL_ADMIN: 'INTERNAL_ADMIN',
    INTERNAL_SUPPORT: 'INTERNAL_SUPPORT',
    INTERNAL_BILLING: 'INTERNAL_BILLING',
    COPYWRITE: 'COPYWRITE',
} as const;

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];
