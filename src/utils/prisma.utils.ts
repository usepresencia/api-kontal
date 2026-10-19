/** Indica se o erro é uma violação de constraint única (P2002) do Prisma. */
export function isUniqueConstraintError(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2002'
    );
}

/** Suprime P2002 e relança qualquer outro erro. */
export function ignoreUniqueConstraint(err: unknown): void {
    if (!isUniqueConstraintError(err)) throw err;
}

/** Indica se o erro é uma violação de chave estrangeira (P2003) do Prisma. */
export function isForeignKeyConstraintError(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2003'
    );
}
