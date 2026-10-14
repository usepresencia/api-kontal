export interface ApiErrorLogInput {
    correlationId: string;
    message: string;
    stack?: string;
    code: string;
    status: number;
    method: string;
    /** Padrão da rota no Express, ex.: `/api/v1/auth/me`. */
    route?: string;
    /** Caminho real, sem query string. */
    path: string;
    companyId?: string;
    userUid?: string;
}

export interface ErrorLogSink {
    write(input: ApiErrorLogInput): Promise<void>;
}
