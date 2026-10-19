export interface IClock {
    /** Data de hoje (UTC à meia-noite) no fuso de negócio. */
    today(): Date;
}
