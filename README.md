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

A friendly playground for building and validating Supabase Row-Level Security (RLS) using LaunchQL. It includes real-world examples, migrations, and a comprehensive test suite you can run locally.

Built with [supabase-test](https://www.npmjs.com/package/supabase-test) — a Supabase-optimized version of `pgsql-test` for instant, isolated Postgres test databases with automatic rollbacks and Supabase defaults.

## Features

- 🔐 **RLS Policy Testing** - Real-world examples with users and products tables
- 🧪 **Comprehensive Test Suite** - End-to-end tests against native Supabase schemas
- 🐘 **Zero-Setup Postgres** - Supabase CLI local stack for instant development
- ⚡ **Jest Integration** - Fast, isolated tests with automatic rollbacks
- 🚀 **CI/CD Ready** - GitHub Actions workflows for automated testing
- 🧩 **Modular Architecture** - Reusable schema packages you can extend

## Quick Start

```bash
# Initialize and start local Supabase stack
npx supabase init
npx supabase start

# Install dependencies
pnpm install

# Run tests in watch mode
cd packages/rls-demo
pnpm test:watch
```

## Repository Structure

This is a LaunchQL workspace combining `pnpm` and `lql` for modular Postgres packages:

- **`packages/supabase`** - Supabase-focused SQL, tests, and helpers
- **`packages/rls-demo`** - Demo extension showcasing RLS with users/products

## Testing

Run tests in different modes:

```bash
# Run all tests from root
pnpm test

# Watch mode for specific package
cd packages/rls-demo
pnpm test:watch

# Run Supabase package tests
cd packages/supabase
pnpm test:watch
```

## Requirements

- Node.js 20+
- pnpm 10+
- Supabase CLI 2+

## Troubleshooting

If you encounter connection issues, set your environment variables:

```bash
export PGPORT=54322
export PGHOST=localhost
export PGUSER=postgres
export PGPASSWORD=postgres
```

Common issues:
- Ensure Supabase services are running (`npx supabase status`)
- Check that ports match those shown by `npx supabase start`
- Use Node.js 20+ to avoid compatibility issues

## Related LaunchQL Tooling

* [launchql/pgsql-test](https://github.com/launchql/launchql/tree/main/packages/pgsql-test): **📊 Isolated testing environments** with per-test transaction rollbacks—ideal for integration tests, complex migrations, and RLS simulation.
* [launchql/supabase-test](https://github.com/launchql/launchql/tree/main/packages/supabase-test): **🧪 Supabase-native test harness** preconfigured for the local Supabase stack—per-test rollbacks, JWT/role context helpers, and CI/GitHub Actions ready.

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED "AS IS", AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.