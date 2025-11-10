# Supabase Test Suite

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/launchql/supabase-test/refs/heads/main/docs/img/logos.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/launchql/supabase-test/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/launchql/supabase-test/actions/workflows/ci.yml/badge.svg" />
  </a>
   <a href="https://github.com/launchql/supabase-test/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
</p>


A friendly playground for building and validating Supabase Row‑Level Security (RLS) using LaunchQL. It includes real‑world examples, migrations, and a comprehensive test suite you can run locally.

Built with [supabase-test](https://www.npmjs.com/package/supabase-test) — a Supabase‑optimized version of `pgsql-test` for instant, isolated Postgres test databases with automatic rollbacks and Supabase defaults. See the package for install and features.

## Features

- 🔐 RLS policy‑driven example tests with example product database using Supabase users
- 🧪 Comprehensive end‑to‑end test suite against native Supabase schemas/tables (auth, storage, functions, realtime, and more)
- 🐘 Supabase CLI local stack for zero‑setup Postgres
- 🧪 Jest‑based tests that exercise RLS behavior end‑to‑end
- 🚀 GitHub Actions workflows to run integration/e2e tests in CI/CD
- 🧩 Modular schema packages you can reuse and extend

## Quick start (tl;dr)

```bash
# bring up a local supabase stack
npx supabase init
npx supabase start

# install deps and run all package tests
pnpm install

# run every package’s tests
pnpm test
```

## getting started (step by step)

this section will walk through everything slowly, from installing tools to running focused tests and exploring the schemas.

1. install prerequisites (node, pnpm, supabase cli)
2. initialize supabase and confirm services are healthy
3. configure pg env vars if your shell needs them
4. run migrations or package deploys as needed
5. run tests (full suite and targeted)
6. inspect policies and iterate

for the expanded guide with screenshots and copy‑paste commands, see `docs/img/USAGE.md` (coming soon).

## repository layout

The repository is a launchql workspace, which is a hybrid `pnpm`/`lql` workspace, which allows for modular postgres packages, that can be easily tested via `pgsql-test`, or in the case of this repository, `supabase-test`. Here are the packages of interest:

- `packages/supabase`: supabase‑focused sql, tests, and helpers
- `packages/rls-demo`: demo extension showcasing rls with users/products

## scripts you’ll use often

```bash
# rls-demo: run tests in watch mode
cd packages/rls-demo
pnpm test:watch

# edit tests in packages/rls-demo/__tests__/... and Jest will re-run
```

```bash
# supabase: run tests in watch mode
cd packages/supabase
pnpm test:watch
```

```bash
# run all packages’ tests from the repo root
pnpm test
```

## Adding a package using `lql`

## Requirements

- Node.js 20+
- pnpm 10+
- Supabase CLI 2+

## troubleshooting

- if your environment needs explicit pg variables, export and retry:

```bash
export PGPORT=54322
export PGHOST=localhost
export PGUSER=postgres
export PGPASSWORD=postgres
```

- if `pnpm test` can’t reach postgres, confirm supabase services are running and the `PG*` env vars match the port printed by `npx supabase start`
- if ports are busy, stop old containers or pass a different port to supabase
- node version mismatches can cause odd errors; use node 20+

## Related LaunchQL Tooling

* [launchql/pgsql-test](https://github.com/launchql/launchql/tree/main/packages/pgsql-test): **📊 Isolated testing environments** with per-test transaction rollbacks—ideal for integration tests, complex migrations, and RLS simulation.
* [launchql/supabase-test](https://github.com/launchql/launchql/tree/main/packages/supabase-test): **🧪 Supabase-native test harness** preconfigured for the local Supabase stack—per-test rollbacks, JWT/role context helpers, and CI/GitHub Actions ready.

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED "AS IS", AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.
