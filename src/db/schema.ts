import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const providerStatus = pgEnum('provider_status', ['active', 'inactive']);
export const credentialStatus = pgEnum('credential_status', ['pending', 'active', 'expired', 'suspended']);
export const attestationStatus = pgEnum('attestation_status', ['pending', 'approved', 'rejected']);
export const enrollmentStatus = pgEnum('enrollment_status', ['not_started', 'in_progress', 'submitted', 'approved', 'denied']);
export const reconciliationDiffStatus = pgEnum('reconciliation_diff_status', ['open', 'in_review', 'resolved']);
export const reconciliationDiffSeverity = pgEnum('reconciliation_diff_severity', ['low', 'medium', 'high', 'critical']);
export const alertStatus = pgEnum('alert_status', ['open', 'acknowledged', 'resolved']);

export const provider = pgTable('provider', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: varchar('external_id', { length: 128 }),
  npi: varchar('npi', { length: 20 }).notNull(),
  firstName: varchar('first_name', { length: 120 }).notNull(),
  lastName: varchar('last_name', { length: 120 }).notNull(),
  email: varchar('email', { length: 320 }),
  status: providerStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('provider_npi_uq').on(table.npi),
  uniqueIndex('provider_external_id_uq').on(table.externalId),
]);

export const providerLocation = pgTable('provider_location', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => provider.id, { onDelete: 'cascade' }),
  externalId: varchar('external_id', { length: 128 }),
  name: varchar('name', { length: 255 }).notNull(),
  line1: varchar('line1', { length: 255 }).notNull(),
  line2: varchar('line2', { length: 255 }),
  city: varchar('city', { length: 120 }).notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  effectiveStartAt: timestamp('effective_start_at', { withTimezone: true }),
  effectiveEndAt: timestamp('effective_end_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('provider_location_provider_id_idx').on(table.providerId),
  uniqueIndex('provider_location_external_id_uq').on(table.externalId),
]);

export const credential = pgTable('credential', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => provider.id, { onDelete: 'cascade' }),
  providerLocationId: uuid('provider_location_id').references(() => providerLocation.id, { onDelete: 'set null' }),
  externalId: varchar('external_id', { length: 128 }),
  type: varchar('type', { length: 100 }).notNull(),
  issuingAuthority: varchar('issuing_authority', { length: 255 }),
  sourceSystem: varchar('source_system', { length: 100 }),
  status: credentialStatus('status').notNull().default('pending'),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('credential_provider_id_idx').on(table.providerId),
  index('credential_status_expires_at_idx').on(table.status, table.expiresAt),
  uniqueIndex('credential_external_id_uq').on(table.externalId),
]);

export const sourceSnapshot = pgTable('source_snapshot', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').references(() => provider.id, { onDelete: 'set null' }),
  credentialId: uuid('credential_id').references(() => credential.id, { onDelete: 'set null' }),
  sourceSystem: varchar('source_system', { length: 100 }).notNull(),
  sourceEntityType: varchar('source_entity_type', { length: 100 }).notNull(),
  sourceEntityId: varchar('source_entity_id', { length: 120 }).notNull(),
  collectedAt: timestamp('collected_at', { withTimezone: true }).notNull(),
  payloadHash: varchar('payload_hash', { length: 128 }).notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('source_snapshot_source_collected_idx').on(table.sourceSystem, table.collectedAt),
  index('source_snapshot_provider_id_idx').on(table.providerId),
]);

export const attestation = pgTable('attestation', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => provider.id, { onDelete: 'cascade' }),
  credentialId: uuid('credential_id').references(() => credential.id, { onDelete: 'set null' }),
  status: attestationStatus('status').notNull().default('pending'),
  attestedBy: varchar('attested_by', { length: 120 }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  decisionAt: timestamp('decision_at', { withTimezone: true }),
  responsePayload: jsonb('response_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('attestation_provider_id_idx').on(table.providerId),
  index('attestation_credential_id_idx').on(table.credentialId),
]);

export const enrollmentWorkflow = pgTable('enrollment_workflow', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => provider.id, { onDelete: 'cascade' }),
  providerLocationId: uuid('provider_location_id').references(() => providerLocation.id, { onDelete: 'set null' }),
  payerName: varchar('payer_name', { length: 255 }).notNull(),
  networkName: varchar('network_name', { length: 255 }),
  externalCaseId: varchar('external_case_id', { length: 120 }),
  status: enrollmentStatus('status').notNull().default('not_started'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('enrollment_workflow_provider_id_idx').on(table.providerId),
  index('enrollment_workflow_status_updated_at_idx').on(table.status, table.updatedAt),
  uniqueIndex('enrollment_workflow_external_case_id_uq').on(table.externalCaseId),
]);

export const enrollmentStep = pgTable('enrollment_step', {
  id: uuid('id').defaultRandom().primaryKey(),
  enrollmentWorkflowId: uuid('enrollment_workflow_id').notNull().references(() => enrollmentWorkflow.id, { onDelete: 'cascade' }),
  stepKey: varchar('step_key', { length: 100 }).notNull(),
  stepLabel: varchar('step_label', { length: 255 }).notNull(),
  status: enrollmentStatus('status').notNull().default('not_started'),
  actorType: varchar('actor_type', { length: 50 }),
  actorId: varchar('actor_id', { length: 120 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('enrollment_step_workflow_id_idx').on(table.enrollmentWorkflowId),
  index('enrollment_step_status_due_at_idx').on(table.status, table.dueAt),
]);

export const reconciliationRun = pgTable('reconciliation_run', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceSystem: varchar('source_system', { length: 100 }).notNull(),
  scope: varchar('scope', { length: 120 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('in_progress'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  runMetadata: jsonb('run_metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('reconciliation_run_source_started_idx').on(table.sourceSystem, table.startedAt),
]);

export const reconciliationDiff = pgTable('reconciliation_diff', {
  id: uuid('id').defaultRandom().primaryKey(),
  reconciliationRunId: uuid('reconciliation_run_id').notNull().references(() => reconciliationRun.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id').references(() => provider.id, { onDelete: 'set null' }),
  credentialId: uuid('credential_id').references(() => credential.id, { onDelete: 'set null' }),
  diffType: varchar('diff_type', { length: 100 }).notNull(),
  fieldPath: varchar('field_path', { length: 255 }),
  expectedValue: text('expected_value'),
  observedValue: text('observed_value'),
  status: reconciliationDiffStatus('status').notNull().default('open'),
  severity: reconciliationDiffSeverity('severity').notNull().default('medium'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('reconciliation_diff_run_id_idx').on(table.reconciliationRunId),
  index('reconciliation_diff_status_severity_idx').on(table.status, table.severity),
]);

export const alert = pgTable('alert', {
  id: uuid('id').defaultRandom().primaryKey(),
  reconciliationDiffId: uuid('reconciliation_diff_id').references(() => reconciliationDiff.id, { onDelete: 'set null' }),
  providerId: uuid('provider_id').references(() => provider.id, { onDelete: 'set null' }),
  enrollmentWorkflowId: uuid('enrollment_workflow_id').references(() => enrollmentWorkflow.id, { onDelete: 'set null' }),
  status: alertStatus('status').notNull().default('open'),
  severity: reconciliationDiffSeverity('severity').notNull().default('medium'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  dueAt: timestamp('due_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('alert_open_state_idx').on(table.status, table.severity),
  index('alert_provider_id_idx').on(table.providerId),
]);

export const auditEvent = pgTable('audit_event', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorType: varchar('actor_type', { length: 50 }).notNull(),
  actorId: varchar('actor_id', { length: 120 }).notNull(),
  action: varchar('action', { length: 120 }).notNull(),
  entityType: varchar('entity_type', { length: 120 }).notNull(),
  entityId: varchar('entity_id', { length: 120 }).notNull(),
  details: jsonb('details'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('audit_event_entity_idx').on(table.entityType, table.entityId),
  index('audit_event_occurred_at_idx').on(table.occurredAt),
]);
