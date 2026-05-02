import { createHash } from 'node:crypto';

export interface IngestRecord {
  sourceEntityType: string;
  sourceEntityId: string;
  sourceSystem: string;
  providerId?: string;
  credentialId?: string;
  collectedAt?: Date;
  payload: Record<string, unknown>;
}

export interface SourceSnapshotWrite {
  sourceSystem: string;
  sourceEntityType: string;
  sourceEntityId: string;
  providerId?: string;
  credentialId?: string;
  collectedAt: Date;
  payloadHash: string;
  payload: Record<string, unknown>;
}

export type DiffSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DiffCandidate {
  providerId?: string;
  credentialId?: string;
  diffType: string;
  fieldPath?: string;
  expectedValue?: string;
  observedValue?: string;
  severity?: DiffSeverity;
  metadata?: Record<string, unknown>;
}

export interface ReconciliationRunDescriptor {
  sourceSystem: string;
  scope: string;
  runMetadata?: Record<string, unknown>;
}

export interface StartedRun {
  id: string;
  startedAt: Date;
}

export interface PipelineRepository {
  startRun(descriptor: ReconciliationRunDescriptor): Promise<StartedRun>;
  writeSnapshots(runId: string, snapshots: SourceSnapshotWrite[]): Promise<void>;
  writeDiffs(runId: string, diffs: DiffCandidate[]): Promise<void>;
  completeRun(runId: string, status: 'completed' | 'failed', metadata?: Record<string, unknown>): Promise<void>;
}

export interface DiffEngine {
  buildDiffs(input: {
    run: ReconciliationRunDescriptor;
    snapshots: SourceSnapshotWrite[];
  }): Promise<DiffCandidate[]>;
}

export interface ReconciliationExecutionSummary {
  runId: string;
  snapshotsIngested: number;
  diffsDetected: number;
}

export class NoopDiffEngine implements DiffEngine {
  async buildDiffs(): Promise<DiffCandidate[]> {
    return [];
  }
}

export class ReconciliationPipeline {
  constructor(
    private readonly repository: PipelineRepository,
    private readonly diffEngine: DiffEngine = new NoopDiffEngine(),
  ) {}

  async run(
    descriptor: ReconciliationRunDescriptor,
    records: IngestRecord[],
  ): Promise<ReconciliationExecutionSummary> {
    const startedRun = await this.repository.startRun(descriptor);

    try {
      const snapshots = records.map((record) => toSourceSnapshotWrite(record));
      await this.repository.writeSnapshots(startedRun.id, snapshots);

      const diffs = await this.diffEngine.buildDiffs({
        run: descriptor,
        snapshots,
      });

      if (diffs.length > 0) {
        await this.repository.writeDiffs(startedRun.id, diffs);
      }

      await this.repository.completeRun(startedRun.id, 'completed', {
        snapshotsIngested: snapshots.length,
        diffsDetected: diffs.length,
      });

      return {
        runId: startedRun.id,
        snapshotsIngested: snapshots.length,
        diffsDetected: diffs.length,
      };
    } catch (error) {
      await this.repository.completeRun(startedRun.id, 'failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown pipeline error',
      });
      throw error;
    }
  }
}

export function toSourceSnapshotWrite(record: IngestRecord): SourceSnapshotWrite {
  return {
    sourceSystem: record.sourceSystem,
    sourceEntityType: record.sourceEntityType,
    sourceEntityId: record.sourceEntityId,
    providerId: record.providerId,
    credentialId: record.credentialId,
    collectedAt: record.collectedAt ?? new Date(),
    payloadHash: hashPayload(record.payload),
    payload: record.payload,
  };
}

export function hashPayload(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(sortObject(payload));
  return createHash('sha256').update(canonical).digest('hex');
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }

  if (value && typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortObject(nestedValue)] as const);
    return Object.fromEntries(sortedEntries);
  }

  return value;
}
