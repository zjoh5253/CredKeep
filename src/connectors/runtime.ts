export interface ConnectorContext {
  now: Date;
}

export interface ConnectorRunResult {
  recordsProcessed: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface Connector {
  id: string;
  scheduleMs: number;
  run(ctx: ConnectorContext): Promise<ConnectorRunResult>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
}

export interface RuntimeEvent {
  connectorId: string;
  event:
    | 'connector.started'
    | 'connector.succeeded'
    | 'connector.retrying'
    | 'connector.failed'
    | 'connector.skipped';
  attempt?: number;
  durationMs?: number;
  message?: string;
  occurredAt: string;
}

export interface RuntimeObserver {
  onEvent(event: RuntimeEvent): void;
}

export interface FailureQueueItem {
  connectorId: string;
  failedAt: string;
  attempts: number;
  errorMessage: string;
}

export interface ConnectorRuntimeOptions {
  retryPolicy?: RetryPolicy;
  observer?: RuntimeObserver;
}

interface ConnectorState {
  connector: Connector;
  nextRunAt: number;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: 500,
};

export class InMemoryFailureQueue {
  private readonly items: FailureQueueItem[] = [];

  push(item: FailureQueueItem): void {
    this.items.push(item);
  }

  all(): FailureQueueItem[] {
    return [...this.items];
  }
}

export class ConnectorRuntime {
  private readonly retryPolicy: RetryPolicy;
  private readonly observer?: RuntimeObserver;
  private readonly states = new Map<string, ConnectorState>();
  private readonly failureQueue = new InMemoryFailureQueue();

  constructor(options: ConnectorRuntimeOptions = {}) {
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.observer = options.observer;
  }

  registerConnector(connector: Connector, now = new Date()): void {
    this.states.set(connector.id, {
      connector,
      nextRunAt: now.getTime(),
    });
  }

  listFailures(): FailureQueueItem[] {
    return this.failureQueue.all();
  }

  async runDue(now = new Date()): Promise<void> {
    const dueStates = [...this.states.values()].filter(
      (state) => state.nextRunAt <= now.getTime(),
    );

    for (const state of dueStates) {
      await this.runConnector(state, now);
    }
  }

  private async runConnector(state: ConnectorState, now: Date): Promise<void> {
    const startedAt = Date.now();
    this.emit({
      connectorId: state.connector.id,
      event: 'connector.started',
      occurredAt: now.toISOString(),
    });

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt += 1) {
      try {
        await state.connector.run({ now });
        const finishedAt = Date.now();
        state.nextRunAt = now.getTime() + state.connector.scheduleMs;
        this.emit({
          connectorId: state.connector.id,
          event: 'connector.succeeded',
          attempt,
          durationMs: finishedAt - startedAt,
          occurredAt: now.toISOString(),
        });
        return;
      } catch (error) {
        lastError = error;
        const canRetry = attempt < this.retryPolicy.maxAttempts;
        if (canRetry) {
          this.emit({
            connectorId: state.connector.id,
            event: 'connector.retrying',
            attempt,
            message: error instanceof Error ? error.message : 'Unknown connector error',
            occurredAt: now.toISOString(),
          });
          await sleep(this.retryPolicy.backoffMs);
          continue;
        }
      }
    }

    const finishedAt = Date.now();
    const message = lastError instanceof Error ? lastError.message : 'Unknown connector error';
    this.failureQueue.push({
      connectorId: state.connector.id,
      failedAt: now.toISOString(),
      attempts: this.retryPolicy.maxAttempts,
      errorMessage: message,
    });
    state.nextRunAt = now.getTime() + state.connector.scheduleMs;
    this.emit({
      connectorId: state.connector.id,
      event: 'connector.failed',
      attempt: this.retryPolicy.maxAttempts,
      durationMs: finishedAt - startedAt,
      message,
      occurredAt: now.toISOString(),
    });
  }

  private emit(event: RuntimeEvent): void {
    this.observer?.onEvent(event);
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
