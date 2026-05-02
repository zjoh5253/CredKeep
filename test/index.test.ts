import { describe, expect, it } from 'vitest';
import { healthCheck } from '../src/index';

describe('healthCheck', () => {
  it('returns ok', () => {
    expect(healthCheck()).toBe('ok');
  });
});
