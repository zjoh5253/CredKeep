import { describe, expect, it } from 'vitest';
import { getSentryEnvironment, getSentryRelease } from '../src/sentry/release';

describe('sentry release metadata', () => {
  it('prefers explicit SENTRY_RELEASE', () => {
    process.env.SENTRY_RELEASE = 'custom-release';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123abc123abc123';
    expect(getSentryRelease()).toBe('custom-release');
    delete process.env.SENTRY_RELEASE;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
  });

  it('builds release from env + commit when explicit release is missing', () => {
    process.env.SENTRY_ENVIRONMENT = 'production';
    process.env.VERCEL_GIT_COMMIT_SHA = '0123456789abcdef';
    expect(getSentryRelease()).toBe('production-0123456789ab');
    delete process.env.SENTRY_ENVIRONMENT;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
  });

  it('falls back to development-local release', () => {
    delete process.env.SENTRY_RELEASE;
    delete process.env.SENTRY_ENVIRONMENT;
    delete process.env.NODE_ENV;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GITHUB_SHA;
    delete process.env.COMMIT_SHA;
    expect(getSentryRelease()).toBe('development-local');
    expect(getSentryEnvironment()).toBe('development');
  });
});
