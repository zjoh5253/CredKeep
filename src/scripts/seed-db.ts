import dotenv from 'dotenv';

import { createDbClient } from '../db/client';
import {
  alert,
  attestation,
  auditEvent,
  credential,
  enrollmentStep,
  enrollmentWorkflow,
  provider,
  providerLocation,
  reconciliationDiff,
  reconciliationRun,
  sourceSnapshot,
} from '../db/schema';

dotenv.config();

const { db, pool } = createDbClient();

async function main(): Promise<void> {
  const [demoProvider] = await db
    .insert(provider)
    .values({
      externalId: 'provider_demo_001',
      npi: '1558483321',
      firstName: 'Avery',
      lastName: 'Nguyen',
      email: 'avery.nguyen@example.com',
      status: 'active',
    })
    .returning();

  if (!demoProvider) {
    throw new Error('Failed to create demo provider.');
  }

  const [location] = await db
    .insert(providerLocation)
    .values({
      providerId: demoProvider.id,
      externalId: 'location_demo_001',
      name: 'Denver Main Office',
      line1: '100 Market St',
      city: 'Denver',
      state: 'CO',
      postalCode: '80202',
      effectiveStartAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning();

  if (!location) {
    throw new Error('Failed to create demo provider location.');
  }

  const [demoCredential] = await db
    .insert(credential)
    .values({
      providerId: demoProvider.id,
      providerLocationId: location.id,
      externalId: 'credential_demo_001',
      type: 'state_license',
      issuingAuthority: 'Colorado Medical Board',
      sourceSystem: 'caqh',
      status: 'active',
      issuedAt: new Date('2024-01-01T00:00:00Z'),
      expiresAt: new Date('2027-01-01T00:00:00Z'),
      verifiedAt: new Date(),
      metadata: { licenseNumber: 'CO-MD-554433' },
    })
    .returning();

  if (!demoCredential) {
    throw new Error('Failed to create demo credential.');
  }

  await db.insert(sourceSnapshot).values({
    providerId: demoProvider.id,
    credentialId: demoCredential.id,
    sourceSystem: 'caqh',
    sourceEntityType: 'credential',
    sourceEntityId: 'caqh_cred_9988',
    collectedAt: new Date(),
    payloadHash: 'sha256-demo-hash',
    payload: { source: 'demo-seed', credentialType: 'state_license' },
  });

  await db.insert(attestation).values({
    providerId: demoProvider.id,
    credentialId: demoCredential.id,
    status: 'approved',
    attestedBy: 'system',
    submittedAt: new Date(),
    decisionAt: new Date(),
    responsePayload: { source: 'demo-seed', decision: 'approved' },
  });

  const [workflow] = await db
    .insert(enrollmentWorkflow)
    .values({
      providerId: demoProvider.id,
      providerLocationId: location.id,
      payerName: 'Aetna',
      networkName: 'Commercial',
      externalCaseId: 'AET-CASE-998877',
      status: 'in_progress',
      submittedAt: new Date(),
    })
    .returning();

  if (!workflow) {
    throw new Error('Failed to create demo enrollment workflow.');
  }

  await db.insert(enrollmentStep).values({
    enrollmentWorkflowId: workflow.id,
    stepKey: 'application_submitted',
    stepLabel: 'Application Submitted',
    status: 'submitted',
    actorType: 'system',
    actorId: 'seed-script',
    startedAt: new Date(),
    completedAt: new Date(),
  });

  const [run] = await db
    .insert(reconciliationRun)
    .values({
      sourceSystem: 'caqh',
      scope: 'provider_credentials',
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      runMetadata: { sourceSnapshotCount: 1 },
    })
    .returning();

  if (!run) {
    throw new Error('Failed to create demo reconciliation run.');
  }

  const [diff] = await db
    .insert(reconciliationDiff)
    .values({
      reconciliationRunId: run.id,
      providerId: demoProvider.id,
      credentialId: demoCredential.id,
      diffType: 'mismatch',
      fieldPath: 'credential.expiresAt',
      expectedValue: '2027-01-01',
      observedValue: '2026-12-01',
      status: 'open',
      severity: 'high',
      metadata: { source: 'demo-seed' },
    })
    .returning();

  if (!diff) {
    throw new Error('Failed to create demo reconciliation diff.');
  }

  await db.insert(alert).values({
    reconciliationDiffId: diff.id,
    providerId: demoProvider.id,
    enrollmentWorkflowId: workflow.id,
    status: 'open',
    severity: 'high',
    title: 'Credential expiry mismatch',
    message: 'Observed expiry date does not match authoritative source.',
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    metadata: { channel: 'email' },
  });

  await db.insert(auditEvent).values({
    actorType: 'system',
    actorId: 'seed-script',
    action: 'seed_completed',
    entityType: 'provider',
    entityId: demoProvider.id,
    details: { providerId: demoProvider.id, credentialId: demoCredential.id },
  });

  await pool.end();
  console.log(`Seed complete. providerId=${demoProvider.id} credentialId=${demoCredential.id}`);
}

main().catch(async (error: unknown) => {
  console.error('Seed failed:', error);
  await pool.end();
  process.exit(1);
});
