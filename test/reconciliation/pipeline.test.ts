import { describe, expect, it, vi } from 'vitest';
import {
  type DiffCandidate,
  type DiffEngine,
  type PipelineRepository,
  ReconciliationPipeline,
  hashPayload,
  toSourceSnapshotWrite,
} from '../../src/reconciliation/pipeline';

function buildRepositorySpy(): PipelineRepository {
  return {
    startRun: vi.fn().mockResolvedValue({ id: 'run-123', startedAt: new Date('2026-05-02T12:00:00.000Z') }),
    writeSnapshots: vi.fn().mockResolvedValue(undefined),
    writeDiffs: vi.fn().mockResolvedValue(undefined),
    completeRun: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ReconciliationPipeline', () => {
  it('ingests snapshots, writes diffs, and completes run', async () => {
    const repository = buildRepositorySpy();
    const diffEngine: DiffEngine = {
      buildDiffs: vi.fn().mockResolvedValue([
        {
          diffType: 'mismatch',
          fieldPath: 'credential.expiresAt',
          expectedValue: '2026-09-01',
          observedValue: '2026-08-01',
        } satisfies DiffCandidate,
      ]),
    };

    const pipeline = new ReconciliationPipeline(repository, diffEngine);
    const summary = await pipeline.run(
      {
        sourceSystem: 'caqh',
        scope: 'provider:prov-1',
      },
      [
        {
          sourceEntityType: 'credential',
          sourceEntityId: 'cred-ext-1',
          sourceSystem: 'caqh',
          providerId: 'prov-1',
          credentialId: 'cred-1',
          collectedAt: new Date('2026-05-02T12:00:00.000Z'),
          payload: { expiresAt: '2026-08-01', status: 'active' },
        },
      ],
    );

    expect(summary).toEqual({
      runId: 'run-123',
      snapshotsIngested: 1,
      diffsDetected: 1,
    });

    expect(repository.startRun).toHaveBeenCalledWith({
      sourceSystem: 'caqh',
      scope: 'provider:prov-1',
    });
    expect(repository.writeSnapshots).toHaveBeenCalledTimes(1);
    expect(repository.writeDiffs).toHaveBeenCalledWith('run-123', [
      {
        diffType: 'mismatch',
        fieldPath: 'credential.expiresAt',
        expectedValue: '2026-09-01',
        observedValue: '2026-08-01',
      },
    ]);
    expect(repository.completeRun).toHaveBeenCalledWith('run-123', 'completed', {
      snapshotsIngested: 1,
      diffsDetected: 1,
    });
  });

  it('marks run failed when ingest errors', async () => {
    const repository = buildRepositorySpy();
    (repository.writeSnapshots as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db unavailable'));
    const pipeline = new ReconciliationPipeline(repository);

    await expect(
      pipeline.run(
        {
          sourceSystem: 'nppes',
          scope: 'provider:prov-2',
        },
        [
          {
            sourceEntityType: 'provider',
            sourceEntityId: 'prov-ext-2',
            sourceSystem: 'nppes',
            payload: { status: 'active' },
          },
        ],
      ),
    ).rejects.toThrow('db unavailable');

    expect(repository.completeRun).toHaveBeenCalledWith('run-123', 'failed', {
      errorMessage: 'db unavailable',
    });
  });
});

describe('hashPayload', () => {
  it('returns same hash for semantically identical objects with different key order', () => {
    const first = hashPayload({ b: 2, a: 1, nested: { y: 'yes', x: 'ex' } });
    const second = hashPayload({ nested: { x: 'ex', y: 'yes' }, a: 1, b: 2 });

    expect(first).toBe(second);
  });

  it('maps ingest record into source snapshot write with hash', () => {
    const collectedAt = new Date('2026-05-02T12:00:00.000Z');
    const snapshot = toSourceSnapshotWrite({
      sourceEntityType: 'credential',
      sourceEntityId: 'cred-ext-3',
      sourceSystem: 'pecos',
      providerId: 'prov-3',
      payload: { status: 'suspended' },
      collectedAt,
    });

    expect(snapshot).toMatchObject({
      sourceEntityType: 'credential',
      sourceEntityId: 'cred-ext-3',
      sourceSystem: 'pecos',
      providerId: 'prov-3',
      collectedAt,
    });
    expect(snapshot.payloadHash).toHaveLength(64);
  });
});
