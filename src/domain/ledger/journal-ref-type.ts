export const JournalRefType = {
    TITLE_CREATION: 'TITLE_CREATION',
    TITLE_CANCELLATION: 'TITLE_CANCELLATION',
    SETTLEMENT: 'SETTLEMENT',
    SETTLEMENT_REVERSAL: 'SETTLEMENT_REVERSAL',
    MANUAL: 'MANUAL',
    MANUAL_REVERSAL: 'MANUAL_REVERSAL',
} as const;

export type JournalRefType = (typeof JournalRefType)[keyof typeof JournalRefType];
