# Supabase RLS Demo

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/launchql/supabase-test/refs/heads/main/docs/img/logos.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/launchql/supabase-test/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/launchql/supabase-test/actions/workflows/ci.yml/badge.svg" />
  </a>
   <a href="https://github.com/launchql/supabase-test/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
</p>

Supabase RLS (Row Level Security) demo, showcasing best practices for implementing secure, multi-tenant applications.

## Features

- 🔐 Complete RLS implementation with users and products tables
- 👥 Multi-tenant data isolation using Supabase auth
- 🧪 Comprehensive test suite with real-world scenarios

## Schema Overview

The `rls_test` schema includes:
- **user_profiles** table with RLS policies for user data access
- **products** table with RLS policies for product ownership
- Proper foreign key constraints and indexes

## Quick Start

```bash
# Run tests
pnpm test

# Watch mode for development
pnpm test:watch
```

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED "AS IS", AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.