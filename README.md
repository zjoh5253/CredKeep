# CredKeep

Credential storage and verification platform.

## PostgreSQL Setup (Supabase or Neon)

CredKeep now includes a Drizzle ORM PostgreSQL schema, generated SQL migrations, and a local seed script.

### 1. Configure connection string

Copy `.env.example` to `.env` and set `DATABASE_URL` to your Supabase or Neon connection string.

```bash
cp .env.example .env
```

### 2. Generate and run migrations

```bash
npm run db:generate
npm run db:migrate
```

### 3. Seed local development data

```bash
npm run db:seed
```

### Included tables

- `practices`
- `providers`
- `credentials`
- `attestations`
- `license_records`
- `payer_enrollments`
- `expiry_events`
- `audit_log`

## Connector Runtime Baseline

Sprint 1 includes a connector orchestration scaffold in `src/connectors/runtime.ts`:

- Connector registration with interval scheduling (`scheduleMs`)
- In-process retry policy (`maxAttempts`, `backoffMs`)
- Runtime observability hooks through typed events (`connector.started`, `connector.retrying`, `connector.succeeded`, `connector.failed`)
- In-memory failure queue for exhausted retries

## Reconciliation Ingest + Diff Pipeline Skeleton

`src/reconciliation/pipeline.ts` now provides a reusable service-layer skeleton for reconciliation runs:

- Run lifecycle orchestration (`startRun` -> snapshot ingest -> diff detection -> `completeRun`)
- Canonical payload hashing (`sha256`) for deterministic source snapshot fingerprints
- Repository interface for DB-backed persistence adapters
- Pluggable `DiffEngine` contract for domain-specific comparison logic

## Sentry Setup

This repository includes Sentry wiring for server and client modules:

- Server init and forced-error capture: `src/sentry/server.ts`
- Client init and forced-error capture: `src/sentry/client.ts`
- Release/environment resolution: `src/sentry/release.ts`

### Environment variables

- `SENTRY_DSN`: Sentry project DSN.
- `SENTRY_AUTH_TOKEN`: required for sourcemap upload with `sentry-cli`.
- `SENTRY_ORG`: Sentry organization slug.
- `SENTRY_PROJECT`: Sentry project slug.
- `SENTRY_ENVIRONMENT`: optional override for environment tag (defaults to `NODE_ENV` then `development`).
- `SENTRY_RELEASE`: optional explicit release; otherwise generated from commit metadata.
- `VERCEL_GIT_COMMIT_SHA` or `GITHUB_SHA`: commit SHA used for release fallback.

### Release + sourcemaps

Generate a release value before upload:

```bash
export SENTRY_RELEASE="${SENTRY_RELEASE:-${SENTRY_ENVIRONMENT:-production}-${VERCEL_GIT_COMMIT_SHA:-$GITHUB_SHA}}"
npm run build
npm run sentry:sourcemaps:upload
```

### Forced error validation

Run server-side forced error capture:

```bash
npm run sentry:validate:server
```

The script emits a test exception tagged with `forced=true` and `validation=server`.

## Clerk Authentication

CredKeep includes Clerk auth helpers in `src/auth/clerk.ts`.

- Token verification helper: `authenticateClerkToken(token, { secretKey, audience? })`
- Role resolution helper: `resolveRoleFromClerkClaims(claims)`
- Supported app roles: `org_admin`, `practice_user`

Role can be sourced from any of:

- `org_role`
- `role`
- `public_metadata.role`
- `private_metadata.role`

DSR handlers accept either explicit context role (`ctx.role`) or Clerk claims (`ctx.clerkClaims`) and enforce `org_admin` access for export/delete operations.
