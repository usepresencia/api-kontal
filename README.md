# api-kontal

API do **Kontal** — gestão financeira e contábil para micro e pequenas
empresas do Simples Nacional e escritórios de contabilidade
terceirizados. NestJS 12 + Prisma 7 + PostgreSQL, no padrão de projeto
da `api-presencia`.

Substitui o backend Django (`accountflow-api`, no monorepo `grupo04`).

## Arquitetura

Camadas na raiz de `src/`: `domain` (entidades, papéis, erros,
interfaces de repositório; TypeScript puro), `application` (services),
`infrastructure` (Prisma, Firebase, guards, logging), `presentation`
(controllers, módulos, filtro global) e `config` (env com Zod).

- **Auth:** Firebase ID token no `Authorization: Bearer` (mesmo projeto
  da Presencia). Acesso restrito a `INTERNAL_ADMIN` e `INTERNAL_BILLING`.
- **Empresa:** header `X-Tenant-Id` (= `companyId`). `INTERNAL_ADMIN` →
  `OWNER`; `INTERNAL_BILLING` → `SUPPORT` (somente leitura).
- **Imports:** alias `@/` mantendo o sufixo `.js`
  (`import { x } from '@/utils/x.js'`).

## Como contribuir

Usamos [Commitizen](https://commitizen.github.io/cz-cli/) e
[Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/).
Em vez de `git commit`, use:

```bash
npm run commit
```

Commits fora do padrão não passam no CI (`commitlint`).

## Rodando localmente

```bash
cp .env.example .env        # preencher FIREBASE_* (service account)
docker compose up -d db
npm install
npm run prisma:deploy
npm run prisma:generate
npm run start:dev
```

## Testes

Metodologia TDD — testes escritos antes do código de produção,
especialmente na camada de tenant/membership e no motor de partida
dobrada.

```bash
npm run test
npm run test:watch
npm run test:cov
```

Testes e2e (Postgres real do `docker compose` e Firebase Auth/Firestore
Emulators, que o `npm run test:e2e` sobe e desliga sozinho; requer Java 21+):

```bash
docker compose up -d db && npm run prisma:deploy && npm run test:e2e
```
