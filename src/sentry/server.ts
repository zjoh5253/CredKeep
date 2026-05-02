import * as Sentry from '@sentry/node';
import { getSentryEnvironment, getSentryRelease } from './release';

export function initServerSentry(): void {
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

export function captureForcedServerError(): Error {
  const err = new Error('Forced Sentry server validation error');
  Sentry.captureException(err, {
    tags: {
      forced: 'true',
      validation: 'server',
    },
    extra: {
      release: getSentryRelease(),
    },
  });
  return err;
}
