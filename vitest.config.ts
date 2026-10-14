import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        root: './',
        include: ['src/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.spec.ts',
                'src/**/*.module.ts',
                'src/**/*.interface.ts',
                'src/**/*.tokens.ts',
                'src/**/*.decorator.ts',
                'src/**/*.controller.ts',
                'src/**/*.types.ts',
                'src/main.ts',
                'src/app.setup.ts',
                'src/infrastructure/persistence/**',
            ],
            thresholds: {
                statements: 80,
                branches: 75,
                functions: 80,
                lines: 80,
                // Os guards têm 1 ramo de metadata de decorator no construtor (não é caminho de código).
                'src/infrastructure/auth/tenant-isolation.guard.ts': {
                    statements: 100,
                    functions: 100,
                    lines: 100,
                    branches: 87,
                },
                'src/infrastructure/auth/tenant-role.resolver.ts': { branches: 100 },
                'src/infrastructure/auth/tenant-id.reader.ts': { branches: 100 },
                'src/infrastructure/auth/platform-staff.guard.ts': {
                    statements: 100,
                    functions: 100,
                    lines: 100,
                    branches: 90,
                },
                'src/domain/auth/effective-role.ts': { branches: 100 },
            },
        },
    },
});
