import { describe, expect, it } from 'vitest';
import { SpendCircuitBreaker } from '../../src/spend/circuit-breaker';

describe('SpendCircuitBreaker', () => {
  it('allows usage within limits and updates counters', () => {
    const breaker = new SpendCircuitBreaker({
      maxTokensPerRequest: 1_000,
      maxTokensPerUserPerDay: 2_000,
      maxTokensPerDay: 3_000,
    });

    const result = breaker.evaluateAndRecord('user-1', 750, new Date('2026-05-02T12:00:00.000Z'));

    expect(result).toEqual({
      allowed: true,
      totals: {
        userTokensToday: 750,
        tokensToday: 750,
      },
    });
  });

  it('blocks requests that exceed per-request token limits', () => {
    const breaker = new SpendCircuitBreaker({
      maxTokensPerRequest: 500,
      maxTokensPerUserPerDay: 10_000,
      maxTokensPerDay: 10_000,
    });

    const result = breaker.evaluateAndRecord('user-1', 501, new Date('2026-05-02T12:00:00.000Z'));

    expect(result).toEqual({
      allowed: false,
      reason: 'request_token_limit_exceeded',
      totals: {
        userTokensToday: 0,
        tokensToday: 0,
      },
    });
  });

  it('blocks users that exceed per-user daily limits', () => {
    const breaker = new SpendCircuitBreaker({
      maxTokensPerRequest: 1_000,
      maxTokensPerUserPerDay: 1_200,
      maxTokensPerDay: 10_000,
    });
    const now = new Date('2026-05-02T12:00:00.000Z');

    const first = breaker.evaluateAndRecord('user-1', 800, now);
    const second = breaker.evaluateAndRecord('user-1', 500, now);

    expect(first.allowed).toBe(true);
    expect(second).toEqual({
      allowed: false,
      reason: 'user_daily_token_limit_exceeded',
      totals: {
        userTokensToday: 800,
        tokensToday: 800,
      },
    });
  });

  it('blocks requests that would exceed global daily limits', () => {
    const breaker = new SpendCircuitBreaker({
      maxTokensPerRequest: 2_000,
      maxTokensPerUserPerDay: 2_000,
      maxTokensPerDay: 1_500,
    });
    const now = new Date('2026-05-02T12:00:00.000Z');

    expect(breaker.evaluateAndRecord('user-1', 900, now).allowed).toBe(true);

    const result = breaker.evaluateAndRecord('user-2', 700, now);

    expect(result).toEqual({
      allowed: false,
      reason: 'daily_token_limit_exceeded',
      totals: {
        userTokensToday: 0,
        tokensToday: 900,
      },
    });
  });

  it('resets per-user and daily budgets at UTC day boundaries', () => {
    const breaker = new SpendCircuitBreaker({
      maxTokensPerRequest: 1_000,
      maxTokensPerUserPerDay: 1_000,
      maxTokensPerDay: 1_000,
    });

    expect(breaker.evaluateAndRecord('user-1', 900, new Date('2026-05-02T23:59:00.000Z')).allowed).toBe(
      true,
    );

    const result = breaker.evaluateAndRecord('user-1', 900, new Date('2026-05-03T00:01:00.000Z'));

    expect(result).toEqual({
      allowed: true,
      totals: {
        userTokensToday: 900,
        tokensToday: 900,
      },
    });
  });
});
