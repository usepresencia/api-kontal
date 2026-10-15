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

## Recursos

- **Empresas** (plataforma, sem `X-Tenant-Id`): `POST/GET /api/v1/companies`, `DELETE /api/v1/companies/:id`
  (escrita só `INTERNAL_ADMIN`).
- **Empresa corrente** (`X-Tenant-Id`): `GET/PUT /api/v1/company` e o logo
  (`POST /company/logo/signature`, `PUT/DELETE /company/logo`).
- **Plano de contas** (`X-Tenant-Id`): `/api/v1/billing-plans` e `/api/v1/billing-accounts`, com hierarquia
  de até 5 níveis, código gerado e isolamento por empresa.
- **Paginação:** `page` e `pageSize` (padrão 10, máximo 100); resposta `{ items, page, pageSize, total }`.
- **Logo:** o front envia a imagem direto ao Cloudinary com a assinatura gerada pela API e depois informa
  a URL. Defina `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` juntas (sem elas,
  as rotas de logo respondem 503 `MEDIA_NOT_CONFIGURED`). Para limitar o tamanho do arquivo, configure um
  _upload preset_ no Cloudinary.
- **Desempenho:** leituras em uma query (`relationLoadStrategy: 'join'`) e listagens sempre paginadas; os
  testes e2e garantem que o número de queries não cresce com o número de linhas.

## Núcleo contábil

- **Presets** (`/api/v1/presets`): atalho de lançamento com as contas a receber, a pagar, de receita,
  de despesa e as de juros, descontos e perdas. Cada conta é validada pela natureza do papel.
- **Títulos** (`/api/v1/titles`): a pagar (`EXPENSE`) e a receber (`INCOME`). Tipo, valor, preset e
  emissão são imutáveis; a criação grava o lançamento de partida dobrada (competência = emissão).
- **Baixas** (`/api/v1/titles/:id/entries`, `/api/v1/entries`): pagamento com juros, multa e desconto
  (total = principal + juros + multa − desconto) e baixa por perda (`POST /titles/:id/write-off`).
  Excluir uma baixa ou um título posta o estorno; o razão nunca é alterado nem apagado.
- **Séries** (`/api/v1/title-series`): parcelado (2 a 60 parcelas) e recorrente (semanal, mensal ou anual,
  com fim por quantidade ou data, até 120 por série), gerados em lote.
- **Valores:** sempre texto com até 2 casas (`"1234.50"`); datas `YYYY-MM-DD`.
- **Consistência:** cada operação roda em uma transação que trava o título; se o lançamento falha, nada
  é gravado. Os testes e2e conferem que o razão fecha (débitos = créditos e saldos de controle = saldos
  em aberto).

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
