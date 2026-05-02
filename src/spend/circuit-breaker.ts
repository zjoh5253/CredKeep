export interface SpendLimitConfig {
  maxTokensPerRequest: number;
  maxTokensPerUserPerDay: number;
  maxTokensPerDay: number;
}

export type SpendLimitRejectionReason =
  | 'request_token_limit_exceeded'
  | 'user_daily_token_limit_exceeded'
  | 'daily_token_limit_exceeded';

export interface SpendUsageTotals {
  userTokensToday: number;
  tokensToday: number;
}

export interface SpendLimitAllowedResult {
  allowed: true;
  totals: SpendUsageTotals;
}

export interface SpendLimitRejectedResult {
  allowed: false;
  reason: SpendLimitRejectionReason;
  totals: SpendUsageTotals;
}

export type SpendLimitResult = SpendLimitAllowedResult | SpendLimitRejectedResult;

export class SpendCircuitBreaker {
  private readonly config: SpendLimitConfig;
  private activeDayKey = '';
  private tokensToday = 0;
  private readonly userTokensToday = new Map<string, number>();

  constructor(config: SpendLimitConfig) {
    validatePositiveInteger(config.maxTokensPerRequest, 'maxTokensPerRequest');
    validatePositiveInteger(config.maxTokensPerUserPerDay, 'maxTokensPerUserPerDay');
    validatePositiveInteger(config.maxTokensPerDay, 'maxTokensPerDay');

    this.config = config;
  }

  evaluateAndRecord(userId: string, requestTokens: number, now = new Date()): SpendLimitResult {
    if (!userId.trim()) {
      throw new Error('userId is required');
    }
    validatePositiveInteger(requestTokens, 'requestTokens');

    this.rotateDayIfNeeded(now);

    const userTokens = this.userTokensToday.get(userId) ?? 0;
    const totals = {
      userTokensToday: userTokens,
      tokensToday: this.tokensToday,
    };

    if (requestTokens > this.config.maxTokensPerRequest) {
      return {
        allowed: false,
        reason: 'request_token_limit_exceeded',
        totals,
      };
    }

    if (userTokens + requestTokens > this.config.maxTokensPerUserPerDay) {
      return {
        allowed: false,
        reason: 'user_daily_token_limit_exceeded',
        totals,
      };
    }

    if (this.tokensToday + requestTokens > this.config.maxTokensPerDay) {
      return {
        allowed: false,
        reason: 'daily_token_limit_exceeded',
        totals,
      };
    }

    const updatedUserTokens = userTokens + requestTokens;
    const updatedDailyTokens = this.tokensToday + requestTokens;

    this.userTokensToday.set(userId, updatedUserTokens);
    this.tokensToday = updatedDailyTokens;

    return {
      allowed: true,
      totals: {
        userTokensToday: updatedUserTokens,
        tokensToday: updatedDailyTokens,
      },
    };
  }

  snapshot(now = new Date()): SpendUsageTotals {
    this.rotateDayIfNeeded(now);
    return {
      userTokensToday: 0,
      tokensToday: this.tokensToday,
    };
  }

  private rotateDayIfNeeded(now: Date): void {
    const nextDayKey = dayKey(now);
    if (nextDayKey === this.activeDayKey) {
      return;
    }

    this.activeDayKey = nextDayKey;
    this.tokensToday = 0;
    this.userTokensToday.clear();
  }
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function validatePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}
