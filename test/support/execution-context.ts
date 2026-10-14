import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

export interface FakeRequest {
    user?: unknown;
    headers: Record<string, unknown>;
    query: Record<string, unknown>;
    tenantCtx?: unknown;
}

/** `ExecutionContext` falso com uma requisição HTTP mutável. */
export function makeContext(request: Partial<FakeRequest> = {}) {
    const req: FakeRequest = { headers: {}, query: {}, ...request };
    class FakeController {}
    const handler = () => undefined;
    const ctx = {
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => handler,
        getClass: () => FakeController,
    } as unknown as ExecutionContext;
    return { ctx, req };
}

/** `Reflector` falso que devolve metadata por chave (ex.: `{ isPublic: true }`). */
export function fakeReflector(metadata: Record<string, unknown> = {}): Reflector {
    return {
        getAllAndOverride: (key: string) => metadata[key],
    } as unknown as Reflector;
}
