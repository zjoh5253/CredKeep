import * as Sentry from '@sentry/browser';
import { getSentryEnvironment, getSentryRelease } from './release';

export function initClientSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    release: getSentryRelease(),
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

export function captureForcedClientError(): Error {
  const err = new Error('Forced Sentry client validation error');
  Sentry.captureException(err, {
    tags: {
      forced: 'true',
      validation: 'client',
    },
    extra: {
      release: getSentryRelease(),
    },
  });
  return err;
}
