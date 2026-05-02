import { SpendCircuitBreaker } from '../spend/circuit-breaker';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  const breaker = new SpendCircuitBreaker({
    maxTokensPerRequest: 2_000,
    maxTokensPerUserPerDay: 2_000,
    maxTokensPerDay: 3_000,
  });
  const now = new Date('2026-05-02T12:00:00.000Z');

  const allowed = breaker.evaluateAndRecord('user-1', 750, now);
  assert(allowed.allowed, 'Expected initial request to pass');

  const perRequest = breaker.evaluateAndRecord('user-1', 2_100, now);
  assert(!perRequest.allowed && perRequest.reason === 'request_token_limit_exceeded', 'Expected per-request breaker');

  const userDaily = breaker.evaluateAndRecord('user-1', 1_300, now);
  assert(!userDaily.allowed && userDaily.reason === 'user_daily_token_limit_exceeded', 'Expected per-user daily breaker');

  const userTwoAllowed = breaker.evaluateAndRecord('user-2', 1_600, now);
  assert(userTwoAllowed.allowed, 'Expected second user request to pass');

  const daily = breaker.evaluateAndRecord('user-3', 800, now);
  assert(!daily.allowed && daily.reason === 'daily_token_limit_exceeded', 'Expected global daily breaker');

  const nextDayAllowed = breaker.evaluateAndRecord('user-1', 900, new Date('2026-05-03T01:00:00.000Z'));
  assert(nextDayAllowed.allowed, 'Expected quotas to reset next UTC day');

  console.log('Spend circuit-breaker validation passed.');
}

main();
