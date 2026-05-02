export type UserRole = 'org_admin' | 'practice_user';

export type ClerkClaims = Record<string, unknown>;

export interface ClerkAuthOptions {
  secretKey: string;
  audience?: string;
}

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  role: UserRole;
  organizationId?: string;
  claims: ClerkClaims;
}

type VerifyTokenFn = (
  token: string,
  options: { secretKey: string; audience?: string },
) => Promise<unknown>;

function readRoleFromMetadata(metadata: unknown): UserRole | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const role = (metadata as Record<string, unknown>).role;
  if (role === 'org_admin' || role === 'practice_user') {
    return role;
  }

  return null;
}

export function resolveRoleFromClerkClaims(claims: ClerkClaims): UserRole | null {
  const directRole = claims.role;
  if (directRole === 'org_admin' || directRole === 'practice_user') {
    return directRole;
  }

  const orgRole = claims.org_role;
  if (orgRole === 'org_admin' || orgRole === 'practice_user') {
    return orgRole;
  }

  return (
    readRoleFromMetadata(claims.public_metadata) ??
    readRoleFromMetadata(claims.private_metadata) ??
    null
  );
}

export async function authenticateClerkToken(
  token: string,
  options: ClerkAuthOptions,
  verifyTokenFn?: VerifyTokenFn,
): Promise<AuthenticatedPrincipal> {
  const verifyToken =
    verifyTokenFn ??
    ((require('@clerk/backend') as { verifyToken: VerifyTokenFn }).verifyToken as VerifyTokenFn);

  const claims = (await verifyToken(token, {
    secretKey: options.secretKey,
    audience: options.audience,
  })) as ClerkClaims;
  const role = resolveRoleFromClerkClaims(claims);
  const userId = typeof claims.sub === 'string' ? claims.sub : null;
  const sessionId = typeof claims.sid === 'string' ? claims.sid : null;
  const organizationId =
    typeof claims.org_id === 'string' ? claims.org_id : undefined;

  if (!userId || !sessionId || !role) {
    throw new Error('Invalid Clerk token claims for CredKeep authorization');
  }

  return {
    userId,
    sessionId,
    role,
    organizationId,
    claims,
  };
}
