CREATE TYPE "public"."attestation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('pending', 'active', 'expired', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('not_started', 'in_progress', 'submitted', 'approved', 'denied');--> statement-breakpoint
CREATE TABLE "attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credential_id" uuid NOT NULL,
	"status" "attestation_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewer" varchar(120),
	"response_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" varchar(50) NOT NULL,
	"actor_id" varchar(120) NOT NULL,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" varchar(120) NOT NULL,
	"details" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"status" "credential_status" DEFAULT 'pending' NOT NULL,
	"source_system" varchar(100),
	"verified_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expiry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"credential_id" uuid,
	"license_record_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "license_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"jurisdiction" varchar(50) NOT NULL,
	"license_number" varchar(100) NOT NULL,
	"issued_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payer_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"payer_name" varchar(255) NOT NULL,
	"payer_provider_id" varchar(120),
	"status" "enrollment_status" DEFAULT 'not_started' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(128),
	"name" varchar(255) NOT NULL,
	"tax_id" varchar(32),
	"npi" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"email" varchar(320),
	"npi" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_credential_id_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expiry_events" ADD CONSTRAINT "expiry_events_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expiry_events" ADD CONSTRAINT "expiry_events_credential_id_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expiry_events" ADD CONSTRAINT "expiry_events_license_record_id_license_records_id_fk" FOREIGN KEY ("license_record_id") REFERENCES "public"."license_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_records" ADD CONSTRAINT "license_records_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payer_enrollments" ADD CONSTRAINT "payer_enrollments_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attestations_credential_id_idx" ON "attestations" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "credentials_provider_id_idx" ON "credentials" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "expiry_events_provider_id_idx" ON "expiry_events" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "expiry_events_due_at_idx" ON "expiry_events" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "license_records_provider_id_idx" ON "license_records" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "payer_enrollments_provider_id_idx" ON "payer_enrollments" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "providers_practice_id_idx" ON "providers" USING btree ("practice_id");