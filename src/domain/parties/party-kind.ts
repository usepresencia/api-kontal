/** Papel da contraparte para o tenant: quem compra dele, quem vende a ele, ou os dois. */
export const PartyKind = { CLIENT: 'CLIENT', SUPPLIER: 'SUPPLIER', BOTH: 'BOTH' } as const;

export type PartyKind = (typeof PartyKind)[keyof typeof PartyKind];
