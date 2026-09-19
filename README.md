# api-kontal

API do **Kontal** — gestão financeira e contábil para micro e pequenas
empresas do Simples Nacional e escritórios de contabilidade
terceirizados. NestJS + Prisma + PostgreSQL.

Este repositório substitui o backend Django do monorepo original
(`grupo04`), portando também o módulo de autorização multiempresa
(`Membership`/`TenantIsolationGuard`) do
[`api-agendaflow`](https://github.com/usepresencia/api-agendaflow).

Contexto completo da migração:
[spec de design](https://github.com/6-Semestre-Grupo-4/grupo04/blob/main/docs/superpowers/specs/2026-09-19-kontal-migration-design.md).

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
npm install
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
