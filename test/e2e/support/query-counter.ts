import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

interface QueryEmitter {
    $on(event: 'query', callback: (event: { query: string }) => void): void;
}

/** Conta as queries SQL emitidas pelo Prisma enquanto uma função roda. */
export class QueryCounter {
    private readonly executed: string[] = [];
    private recording = false;

    constructor(prisma: PrismaService) {
        (prisma as unknown as QueryEmitter).$on('query', event => {
            if (this.recording) this.executed.push(event.query);
        });
    }

    get queries(): readonly string[] {
        return this.executed;
    }

    async count(fn: () => Promise<unknown>): Promise<number> {
        this.executed.length = 0;
        this.recording = true;
        try {
            await fn();
        } finally {
            this.recording = false;
        }
        return this.executed.length;
    }
}
