# Supabase Test

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

## Features

- Policy‑driven examples for users, products, storage, realtime, and functions
- Supabase CLI local stack for zero‑setup Postgres
- Jest‑based tests that exercise RLS behavior end‑to‑end
- Modular schema packages you can reuse and extend

## Quick start (tl;dr)

```bash
# bring up a local supabase stack
npx supabase init
npx supabase start

# install deps and run all package tests
pnpm install

# if your env needs explicit pg vars, export these:
export PGPORT=54322
export PGHOST=localhost
export PGUSER=postgres
export PGPASSWORD=postgres

# run every package’s tests
pnpm test
```

## getting started (step by step)

this section will walk through everything slowly, from installing tools to running focused tests and exploring the schemas.

- [ ] step 1: install prerequisites (node, pnpm, supabase cli)
- [ ] step 2: initialize supabase and confirm services are healthy
- [ ] step 3: configure pg env vars if your shell needs them
- [ ] step 4: run migrations or package deploys as needed
- [ ] step 5: run tests (full suite and targeted)
- [ ] step 6: inspect policies and iterate

for the expanded guide with screenshots and copy‑paste commands, see `docs/img/USAGE.md` (coming soon).

## repository layout

- `packages/supabase`: supabase‑focused sql, tests, and helpers
- `packages/rls-demo`: demo extension showcasing rls with users/products

## scripts you’ll use often

```bash
# run the whole workspace test suite
pnpm test
```

## Adding a package using `lql`

## Requirements

- Node.js 20+
- pnpm 10+
- Supabase CLI 2+

## troubleshooting

- if `pnpm test` can’t reach postgres, confirm supabase services are running and the `PG*` env vars match the port printed by `npx supabase start`
- if ports are busy, stop old containers or pass a different port to supabase
- node version mismatches can cause odd errors; use node 20+




## Related LaunchQL Tooling

### 🧪 Testing

* [launchql/pgsql-test](https://github.com/launchql/launchql/tree/main/packages/pgsql-test): **📊 Isolated testing environments** with per-test transaction rollbacks—ideal for integration tests, complex migrations, and RLS simulation.
* [launchql/graphile-test](https://github.com/launchql/launchql/tree/main/packages/graphile-test): **🔐 Authentication mocking** for Graphile-focused test helpers and emulating row-level security contexts.
* [launchql/pg-query-context](https://github.com/launchql/launchql/tree/main/packages/pg-query-context): **🔒 Session context injection** to add session-local context (e.g., `SET LOCAL`) into queries—ideal for setting `role`, `jwt.claims`, and other session settings.

### 🧠 Parsing & AST

* [launchql/pgsql-parser](https://github.com/launchql/pgsql-parser): **🔄 SQL conversion engine** that interprets and converts PostgreSQL syntax.
* [launchql/libpg-query-node](https://github.com/launchql/libpg-query-node): **🌉 Node.js bindings** for `libpg_query`, converting SQL into parse trees.
* [launchql/pg-proto-parser](https://github.com/launchql/pg-proto-parser): **📦 Protobuf parser** for parsing PostgreSQL Protocol Buffers definitions to generate TypeScript interfaces, utility functions, and JSON mappings for enums.
* [@pgsql/enums](https://github.com/launchql/pgsql-parser/tree/main/packages/enums): **🏷️ TypeScript enums** for PostgreSQL AST for safe and ergonomic parsing logic.
* [@pgsql/types](https://github.com/launchql/pgsql-parser/tree/main/packages/types): **📝 Type definitions** for PostgreSQL AST nodes in TypeScript.
* [@pgsql/utils](https://github.com/launchql/pgsql-parser/tree/main/packages/utils): **🛠️ AST utilities** for constructing and transforming PostgreSQL syntax trees.
* [launchql/pg-ast](https://github.com/launchql/launchql/tree/main/packages/pg-ast): **🔍 Low-level AST tools** and transformations for Postgres query structures.

### 🚀 API & Dev Tools

* [launchql/server](https://github.com/launchql/launchql/tree/main/packages/server): **⚡ Express-based API server** powered by PostGraphile to expose a secure, scalable GraphQL API over your Postgres database.
* [launchql/explorer](https://github.com/launchql/launchql/tree/main/packages/explorer): **🔎 Visual API explorer** with GraphiQL for browsing across all databases and schemas—useful for debugging, documentation, and API prototyping.

### 🔁 Streaming & Uploads

* [launchql/s3-streamer](https://github.com/launchql/launchql/tree/main/packages/s3-streamer): **📤 Direct S3 streaming** for large files with support for metadata injection and content validation.
* [launchql/etag-hash](https://github.com/launchql/launchql/tree/main/packages/etag-hash): **🏷️ S3-compatible ETags** created by streaming and hashing file uploads in chunks.
* [launchql/etag-stream](https://github.com/launchql/launchql/tree/main/packages/etag-stream): **🔄 ETag computation** via Node stream transformer during upload or transfer.
* [launchql/uuid-hash](https://github.com/launchql/launchql/tree/main/packages/uuid-hash): **🆔 Deterministic UUIDs** generated from hashed content, great for deduplication and asset referencing.
* [launchql/uuid-stream](https://github.com/launchql/launchql/tree/main/packages/uuid-stream): **🌊 Streaming UUID generation** based on piped file content—ideal for upload pipelines.
* [launchql/upload-names](https://github.com/launchql/launchql/tree/main/packages/upload-names): **📂 Collision-resistant filenames** utility for structured and unique file names for uploads.

### 🧰 CLI & Codegen

* [@launchql/cli](https://github.com/launchql/launchql/tree/main/packages/cli): **🖥️ Command-line toolkit** for managing LaunchQL projects—supports database scaffolding, migrations, seeding, code generation, and automation.
* [launchql/launchql-gen](https://github.com/launchql/launchql/tree/main/packages/launchql-gen): **✨ Auto-generated GraphQL** mutations and queries dynamically built from introspected schema data.
* [@launchql/query-builder](https://github.com/launchql/launchql/tree/main/packages/query-builder): **🏗️ SQL constructor** providing a robust TypeScript-based query builder for dynamic generation of `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and stored procedure calls—supports advanced SQL features like `JOIN`, `GROUP BY`, and schema-qualified queries.
* [@launchql/query](https://github.com/launchql/launchql/tree/main/packages/query): **🧩 Fluent GraphQL builder** for PostGraphile schemas. ⚡ Schema-aware via introspection, 🧩 composable and ergonomic for building deeply nested queries.

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED "AS IS", AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.
