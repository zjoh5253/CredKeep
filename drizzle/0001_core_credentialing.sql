DROP TABLE IF EXISTS "attestations" CASCADE;
DROP TABLE IF EXISTS "audit_log" CASCADE;
DROP TABLE IF EXISTS "credentials" CASCADE;
DROP TABLE IF EXISTS "expiry_events" CASCADE;
DROP TABLE IF EXISTS "license_records" CASCADE;
DROP TABLE IF EXISTS "payer_enrollments" CASCADE;
DROP TABLE IF EXISTS "providers" CASCADE;
DROP TABLE IF EXISTS "practices" CASCADE;

DROP TYPE IF EXISTS "public"."attestation_status";
DROP TYPE IF EXISTS "public"."credential_status";
DROP TYPE IF EXISTS "public"."enrollment_status";

CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'resolved');
CREATE TYPE "public"."attestation_status" AS ENUM('pending', 'approved', 'rejected');
CREATE TYPE "public"."credential_status" AS ENUM('pending', 'active', 'expired', 'suspended');
CREATE TYPE "public"."enrollment_status" AS ENUM('not_started', 'in_progress', 'submitted', 'approved', 'denied');
CREATE TYPE "public"."provider_status" AS ENUM('active', 'inactive');
CREATE TYPE "public"."reconciliation_diff_severity" AS ENUM('low', 'medium', 'high', 'critical');
CREATE TYPE "public"."reconciliation_diff_status" AS ENUM('open', 'in_review', 'resolved');

CREATE TABLE "provider" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" varchar(128),
  "npi" varchar(20) NOT NULL,
  "first_name" varchar(120) NOT NULL,
  "last_name" varchar(120) NOT NULL,
  "email" varchar(320),
  "status" "provider_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "provider_location" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid NOT NULL,
  "external_id" varchar(128),
  "name" varchar(255) NOT NULL,
  "line1" varchar(255) NOT NULL,
  "line2" varchar(255),
  "city" varchar(120) NOT NULL,
  "state" varchar(2) NOT NULL,
  "postal_code" varchar(20) NOT NULL,
  "effective_start_at" timestamp with time zone,
  "effective_end_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "credential" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid NOT NULL,
  "provider_location_id" uuid,
  "external_id" varchar(128),
  "type" varchar(100) NOT NULL,
  "issuing_authority" varchar(255),
  "source_system" varchar(100),
  "status" "credential_status" DEFAULT 'pending' NOT NULL,
  "issued_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "source_snapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid,
  "credential_id" uuid,
  "source_system" varchar(100) NOT NULL,
  "source_entity_type" varchar(100) NOT NULL,
  "source_entity_id" varchar(120) NOT NULL,
  "collected_at" timestamp with time zone NOT NULL,
  "payload_hash" varchar(128) NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "attestation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid NOT NULL,
  "credential_id" uuid,
  "status" "attestation_status" DEFAULT 'pending' NOT NULL,
  "attested_by" varchar(120),
  "submitted_at" timestamp with time zone,
  "decision_at" timestamp with time zone,
  "response_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "enrollment_workflow" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid NOT NULL,
  "provider_location_id" uuid,
  "payer_name" varchar(255) NOT NULL,
  "network_name" varchar(255),
  "external_case_id" varchar(120),
  "status" "enrollment_status" DEFAULT 'not_started' NOT NULL,
  "submitted_at" timestamp with time zone,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "enrollment_step" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enrollment_workflow_id" uuid NOT NULL,
  "step_key" varchar(100) NOT NULL,
  "step_label" varchar(255) NOT NULL,
  "status" "enrollment_status" DEFAULT 'not_started' NOT NULL,
  "actor_type" varchar(50),
  "actor_id" varchar(120),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "due_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "reconciliation_run" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_system" varchar(100) NOT NULL,
  "scope" varchar(120) NOT NULL,
  "status" varchar(50) DEFAULT 'in_progress' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "run_metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "reconciliation_diff" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reconciliation_run_id" uuid NOT NULL,
  "provider_id" uuid,
  "credential_id" uuid,
  "diff_type" varchar(100) NOT NULL,
  "field_path" varchar(255),
  "expected_value" text,
  "observed_value" text,
  "status" "reconciliation_diff_status" DEFAULT 'open' NOT NULL,
  "severity" "reconciliation_diff_severity" DEFAULT 'medium' NOT NULL,
  "resolved_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "alert" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reconciliation_diff_id" uuid,
  "provider_id" uuid,
  "enrollment_workflow_id" uuid,
  "status" "alert_status" DEFAULT 'open' NOT NULL,
  "severity" "reconciliation_diff_severity" DEFAULT 'medium' NOT NULL,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "due_at" timestamp with time zone,
  "acknowledged_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_type" varchar(50) NOT NULL,
  "actor_id" varchar(120) NOT NULL,
  "action" varchar(120) NOT NULL,
  "entity_type" varchar(120) NOT NULL,
  "entity_id" varchar(120) NOT NULL,
  "details" jsonb,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "provider_location" ADD CONSTRAINT "provider_location_provider_id_provider_id_fk"
  FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credential" ADD CONSTRAINT "credential_provider_id_provider_id_fk"
  FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credential" ADD CONSTRAINT "credential_provider_location_id_provider_location_id_fk"
  FOREIGN KEY ("provider_location_id") REFERENCES "public"."provider_location"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "source_snapshot" ADD CONSTRAINT "source_snapshot_provider_id_provider_id_fk"
  FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "source_snapshot" ADD CONSTRAINT "source_snapshot_credential_id_credential_id_fk"
  FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "attestation" ADD CONSTRAINT "attestation_provider_id_provider_id_fk"
  FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "attestation" ADD CONSTRAINT "attestation_credential_id_credential_id_fk"
  FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "enrollment_workflow" ADD CONSTRAINT "enrollment_workflow_provider_id_provider_id_fk"
  FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "enrollment_workflow" ADD CONSTRAINT "enrollment_workflow_provider_location_id_provider_location_id_fk"
  FOREIGN KEY ("provider_location_id") REFERENCES "public"."provider_location"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "enrollment_step" ADD CONSTRAINT "enrollment_step_enrollment_workflow_id_enrollment_workflow_id_fk"
  FOREIGN KEY ("enrollment_workflow_id") REFERENCES "public"."enrollment_workflow"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reconciliation_diff" ADD CONSTRAINT "reconciliation_diff_reconciliation_run_id_reconciliation_run_id_fk"
  FOREIGN KEY ("reconciliation_run_id") REFERENCES "public"."reconciliation_run"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reconciliation_diff" ADD CONSTRAINT "reconciliation_diff_provider_id_provider_id_fk"
  FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "reconciliation_diff" ADD CONSTRAINT "reconciliation_diff_credential_id_credential_id_fk"
  FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "alert" ADD CONSTRAINT "alert_reconciliation_diff_id_reconciliation_diff_id_fk"
  FOREIGN KEY ("reconciliation_diff_id") REFERENCES "public"."reconciliation_diff"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "alert" ADD CONSTRAINT "alert_provider_id_provider_id_fk"
  FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "alert" ADD CONSTRAINT "alert_enrollment_workflow_id_enrollment_workflow_id_fk"
  FOREIGN KEY ("enrollment_workflow_id") REFERENCES "public"."enrollment_workflow"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "provider_npi_uq" ON "provider" USING btree ("npi");
CREATE UNIQUE INDEX "provider_external_id_uq" ON "provider" USING btree ("external_id");
CREATE INDEX "provider_location_provider_id_idx" ON "provider_location" USING btree ("provider_id");
CREATE UNIQUE INDEX "provider_location_external_id_uq" ON "provider_location" USING btree ("external_id");
CREATE INDEX "credential_provider_id_idx" ON "credential" USING btree ("provider_id");
CREATE INDEX "credential_status_expires_at_idx" ON "credential" USING btree ("status", "expires_at");
CREATE UNIQUE INDEX "credential_external_id_uq" ON "credential" USING btree ("external_id");
CREATE INDEX "source_snapshot_source_collected_idx" ON "source_snapshot" USING btree ("source_system", "collected_at");
CREATE INDEX "source_snapshot_provider_id_idx" ON "source_snapshot" USING btree ("provider_id");
CREATE INDEX "attestation_provider_id_idx" ON "attestation" USING btree ("provider_id");
CREATE INDEX "attestation_credential_id_idx" ON "attestation" USING btree ("credential_id");
CREATE INDEX "enrollment_workflow_provider_id_idx" ON "enrollment_workflow" USING btree ("provider_id");
CREATE INDEX "enrollment_workflow_status_updated_at_idx" ON "enrollment_workflow" USING btree ("status", "updated_at");
CREATE UNIQUE INDEX "enrollment_workflow_external_case_id_uq" ON "enrollment_workflow" USING btree ("external_case_id");
CREATE INDEX "enrollment_step_workflow_id_idx" ON "enrollment_step" USING btree ("enrollment_workflow_id");
CREATE INDEX "enrollment_step_status_due_at_idx" ON "enrollment_step" USING btree ("status", "due_at");
CREATE INDEX "reconciliation_run_source_started_idx" ON "reconciliation_run" USING btree ("source_system", "started_at");
CREATE INDEX "reconciliation_diff_run_id_idx" ON "reconciliation_diff" USING btree ("reconciliation_run_id");
CREATE INDEX "reconciliation_diff_status_severity_idx" ON "reconciliation_diff" USING btree ("status", "severity");
CREATE INDEX "alert_open_state_idx" ON "alert" USING btree ("status", "severity");
CREATE INDEX "alert_provider_id_idx" ON "alert" USING btree ("provider_id");
CREATE INDEX "audit_event_entity_idx" ON "audit_event" USING btree ("entity_type", "entity_id");
CREATE INDEX "audit_event_occurred_at_idx" ON "audit_event" USING btree ("occurred_at");
