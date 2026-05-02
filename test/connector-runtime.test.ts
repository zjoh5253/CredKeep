import { describe, expect, it, vi } from 'vitest';
import {
  ConnectorRuntime,
  type Connector,
  type RuntimeEvent,
  type RuntimeObserver,
} from '../src/connectors/runtime';

class TestObserver implements RuntimeObserver {
  events: RuntimeEvent[] = [];

  onEvent(event: RuntimeEvent): void {
    this.events.push(event);
  }
}

function buildConnector(
  id: string,
  scheduleMs: number,
  runImpl: Connector['run'],
): Connector {
  return {
    id,
    scheduleMs,
    run: runImpl,
  };
}

describe('ConnectorRuntime', () => {
  it('runs due connectors and schedules next run', async () => {
    const observer = new TestObserver();
    const runtime = new ConnectorRuntime({ observer });
    const run = vi.fn().mockResolvedValue({ recordsProcessed: 2 });
    const connector = buildConnector('caqh', 60_000, run);
    const now = new Date('2026-05-02T12:00:00.000Z');

    runtime.registerConnector(connector, now);
    await runtime.runDue(now);
    await runtime.runDue(new Date('2026-05-02T12:00:30.000Z'));
    await runtime.runDue(new Date('2026-05-02T12:01:00.000Z'));

    expect(run).toHaveBeenCalledTimes(2);
    expect(observer.events.filter((event) => event.event === 'connector.succeeded')).toHaveLength(2);
  });

  it('retries on transient failure and succeeds', async () => {
    const observer = new TestObserver();
    const runtime = new ConnectorRuntime({
      observer,
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 0,
      },
    });

    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValue({ recordsProcessed: 5 });

    runtime.registerConnector(buildConnector('nppes', 60_000, run), new Date('2026-05-02T12:00:00.000Z'));
    await runtime.runDue(new Date('2026-05-02T12:00:00.000Z'));

    expect(run).toHaveBeenCalledTimes(2);
    expect(observer.events.some((event) => event.event === 'connector.retrying')).toBe(true);
    expect(runtime.listFailures()).toHaveLength(0);
  });

  it('writes to failure queue when retries are exhausted', async () => {
    const runtime = new ConnectorRuntime({
      retryPolicy: {
        maxAttempts: 2,
        backoffMs: 0,
      },
    });
    const run = vi.fn().mockRejectedValue(new Error('source unavailable'));

    runtime.registerConnector(buildConnector('pecos', 60_000, run), new Date('2026-05-02T12:00:00.000Z'));
    await runtime.runDue(new Date('2026-05-02T12:00:00.000Z'));

    const failures = runtime.listFailures();
    expect(run).toHaveBeenCalledTimes(2);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      connectorId: 'pecos',
      attempts: 2,
      errorMessage: 'source unavailable',
    });
  });
});
