import { describe, expect, it, vi } from 'vitest';
import { authenticateClerkToken, resolveRoleFromClerkClaims } from '../../src/auth/clerk';

describe('resolveRoleFromClerkClaims', () => {
  it('resolves role from org_role and metadata fallbacks', () => {
    expect(resolveRoleFromClerkClaims({ org_role: 'org_admin' })).toBe('org_admin');
    expect(resolveRoleFromClerkClaims({ public_metadata: { role: 'practice_user' } })).toBe(
      'practice_user',
    );
    expect(resolveRoleFromClerkClaims({ private_metadata: { role: 'org_admin' } })).toBe(
      'org_admin',
    );
  });

  it('returns null for unsupported roles', () => {
    expect(resolveRoleFromClerkClaims({ org_role: 'viewer' })).toBeNull();
  });
});

describe('authenticateClerkToken', () => {
  it('returns normalized principal when claims are valid', async () => {
    const verifyTokenMock = vi.fn().mockResolvedValue({
      sub: 'user_123',
      sid: 'sess_123',
      org_id: 'org_123',
      org_role: 'org_admin',
    });

    const principal = await authenticateClerkToken(
      'token',
      { secretKey: 'sk_test_123' },
      verifyTokenMock,
    );

    expect(principal).toMatchObject({
      userId: 'user_123',
      sessionId: 'sess_123',
      organizationId: 'org_123',
      role: 'org_admin',
    });
  });

  it('throws when role is missing from claims', async () => {
    const verifyTokenMock = vi.fn().mockResolvedValue({
      sub: 'user_123',
      sid: 'sess_123',
    });

    await expect(
      authenticateClerkToken('token', { secretKey: 'sk_test_123' }, verifyTokenMock),
    ).rejects.toThrow('Invalid Clerk token claims for CredKeep authorization');
  });
});
