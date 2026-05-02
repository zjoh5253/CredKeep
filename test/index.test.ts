import { describe, expect, it } from 'vitest';
import {
  handleDsrDelete,
  handleDsrExport,
  healthCheck,
  type DataSubjectStore,
} from '../src/index';

function buildStore(): DataSubjectStore {
  return {
    practices: [
      {
        id: 'prac-1',
        name: 'North Clinic',
        providers: [
          {
            id: 'prov-1',
            name: 'Dr. Liao',
            credentials: ['board-certified'],
          },
        ],
      },
    ],
  };
}

describe('healthCheck', () => {
  it('returns ok', () => {
    expect(healthCheck()).toBe('ok');
  });
});

describe('handleDsrExport', () => {
  it('returns all practice/provider data for org_admin', () => {
    const store = buildStore();

    const result = handleDsrExport({ role: 'org_admin' }, store);

    expect(result.status).toBe(200);
    expect(result.body).toEqual(store);
  });

  it('blocks non-admin users', () => {
    const result = handleDsrExport({ role: 'practice_user' }, buildStore());

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: 'org_admin role required' });
  });

  it('accepts org_admin role from Clerk claims', () => {
    const store = buildStore();

    const result = handleDsrExport(
      { clerkClaims: { sub: 'user_123', sid: 'sess_123', org_role: 'org_admin' } },
      store,
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(store);
  });
});

describe('handleDsrDelete', () => {
  it('soft-deletes data and schedules purge in 30 days for org_admin', () => {
    const store = buildStore();
    const now = new Date('2026-05-02T12:00:00.000Z');

    const result = handleDsrDelete({ role: 'org_admin', now }, store);

    expect(result.status).toBe(202);
    expect(result.body).toEqual({
      message: 'Delete request accepted. Records soft-deleted and scheduled for purge in 30 days.',
      purgeAfter: '2026-06-01T12:00:00.000Z',
    });
    expect(store.practices[0].deletedAt).toBe('2026-05-02T12:00:00.000Z');
    expect(store.practices[0].purgeAfter).toBe('2026-06-01T12:00:00.000Z');
    expect(store.practices[0].providers[0].deletedAt).toBe('2026-05-02T12:00:00.000Z');
  });

  it('blocks non-admin users', () => {
    const store = buildStore();

    const result = handleDsrDelete({ role: 'practice_user' }, store);

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: 'org_admin role required' });
    expect(store.practices[0].deletedAt).toBeUndefined();
  });

  it('blocks invalid Clerk role claims', () => {
    const store = buildStore();
    const now = new Date('2026-05-02T12:00:00.000Z');

    const result = handleDsrDelete(
      { clerkClaims: { sub: 'user_123', sid: 'sess_123', org_role: 'viewer' }, now },
      store,
    );

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: 'org_admin role required' });
    expect(store.practices[0].deletedAt).toBeUndefined();
  });
});
