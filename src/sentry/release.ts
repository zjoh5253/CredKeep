function readFirstDefined(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export function getSentryRelease(): string {
  const explicit = readFirstDefined(['SENTRY_RELEASE']);
  if (explicit) {
    return explicit;
  }

  const commit = readFirstDefined(['VERCEL_GIT_COMMIT_SHA', 'GITHUB_SHA', 'COMMIT_SHA']);
  const environment = readFirstDefined(['SENTRY_ENVIRONMENT', 'NODE_ENV']) ?? 'development';

  if (commit) {
    return `${environment}-${commit.slice(0, 12)}`;
  }

  return `${environment}-local`;
}

export function getSentryEnvironment(): string {
  return readFirstDefined(['SENTRY_ENVIRONMENT', 'NODE_ENV']) ?? 'development';
}
