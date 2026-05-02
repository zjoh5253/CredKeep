const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;
import { resolveRoleFromClerkClaims, type ClerkClaims } from './auth/clerk';
export { initServerSentry, captureForcedServerError } from './sentry/server';
export {
  authenticateClerkToken,
  resolveRoleFromClerkClaims,
  type ClerkClaims,
  type AuthenticatedPrincipal,
} from './auth/clerk';
export {
  buildRiskFeed,
  buildExpirationTimeline,
  buildEmailAlerts,
  type RiskProvider,
  type RiskFeedItem,
  type ExpirationTimeline,
  type EmailAlert,
} from './risk/dashboard';
export { SpendCircuitBreaker } from './spend/circuit-breaker';
export {
  STAGE0_PRICING,
  getPaddleEnvironmentFromEnv,
  resolveTierUnitPriceCents,
  buildSandboxCheckoutSession,
  buildPaddleWebhookSignature,
  verifyPaddleWebhookSignature,
  parsePaddleWebhookEvent,
  handlePaddleWebhook,
  type BillingTier,
  type CheckoutRequest,
  type CheckoutSessionInput,
  type Stage0PricingCatalog,
  type BillingActivation,
} from './payments/paddle';
export { createDbClient } from './db/client';
export * from './db/schema';
export {
  ReconciliationPipeline,
  NoopDiffEngine,
  hashPayload,
  toSourceSnapshotWrite,
  type IngestRecord,
  type SourceSnapshotWrite,
  type DiffCandidate,
  type DiffEngine,
  type PipelineRepository,
  type ReconciliationExecutionSummary,
  type ReconciliationRunDescriptor,
} from './reconciliation/pipeline';

export type UserRole = 'org_admin' | 'practice_user';

export interface ProviderRecord {
  id: string;
  name: string;
  credentials: string[];
  deletedAt?: string;
}

export interface PracticeRecord {
  id: string;
  name: string;
  providers: ProviderRecord[];
  deletedAt?: string;
  purgeAfter?: string;
}

export interface DataSubjectStore {
  practices: PracticeRecord[];
}

export interface RequestContext {
  role?: UserRole;
  clerkClaims?: ClerkClaims;
  now?: Date;
}

export interface DsrResponse<T> {
  status: number;
  body: T;
}

export function healthCheck(): string {
  return 'ok';
}

function resolveRequestRole(ctx: RequestContext): UserRole | null {
  if (ctx.role) {
    return ctx.role;
  }

  if (ctx.clerkClaims) {
    return resolveRoleFromClerkClaims(ctx.clerkClaims);
  }

  return null;
}

export function handleDsrExport(
  ctx: RequestContext,
  store: DataSubjectStore,
): DsrResponse<DataSubjectStore | { error: string }> {
  if (resolveRequestRole(ctx) !== 'org_admin') {
    return { status: 403, body: { error: 'org_admin role required' } };
  }

  return {
    status: 200,
    body: JSON.parse(JSON.stringify(store)) as DataSubjectStore,
  };
}

export function handleDsrDelete(
  ctx: RequestContext,
  store: DataSubjectStore,
): DsrResponse<{ message: string; purgeAfter?: string } | { error: string }> {
  if (resolveRequestRole(ctx) !== 'org_admin') {
    return { status: 403, body: { error: 'org_admin role required' } };
  }

  const now = ctx.now ?? new Date();
  const nowIso = now.toISOString();
  const purgeAfter = new Date(now.getTime() + THIRTY_DAYS_IN_MS).toISOString();

  for (const practice of store.practices) {
    practice.deletedAt = nowIso;
    practice.purgeAfter = purgeAfter;

    for (const provider of practice.providers) {
      provider.deletedAt = nowIso;
    }
  }

  return {
    status: 202,
    body: {
      message: 'Delete request accepted. Records soft-deleted and scheduled for purge in 30 days.',
      purgeAfter,
    },
  };
}
