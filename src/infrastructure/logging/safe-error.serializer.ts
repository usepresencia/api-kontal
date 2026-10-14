const MAX_MESSAGE_LENGTH = 500;
const SENSITIVE_KEYS = new Set(['config', 'request', 'authorization', 'cause']);

export interface SerializedError {
    name: string;
    code?: string;
    message: string;
    stack?: string;
}

/** Converte qualquer valor lançado em um erro seguro para log (sem campos sensíveis; stack só fora de produção). */
export function serializeError(err: unknown): SerializedError {
    if (!err) {
        return { name: 'UnknownError', message: 'No error information available' };
    }
    if (typeof err === 'string') {
        return { name: 'Error', message: err.slice(0, MAX_MESSAGE_LENGTH) };
    }
    if (!(err instanceof Error)) {
        const text =
            typeof err === 'object'
                ? JSON.stringify(stripSensitive(err as Record<string, unknown>))
                : String(err as number | boolean | bigint);
        return { name: 'Error', message: text.slice(0, MAX_MESSAGE_LENGTH) };
    }

    const error = err as Error & { code?: string };
    const serialized: SerializedError = {
        name: error.name,
        message: error.message.slice(0, MAX_MESSAGE_LENGTH),
    };
    if (error.code) serialized.code = error.code;
    if (process.env.NODE_ENV !== 'production' && error.stack) serialized.stack = error.stack;
    return serialized;
}

function stripSensitive(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(obj).filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase())),
    );
}
