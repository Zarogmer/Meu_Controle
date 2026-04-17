import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { type UserRole, ROLE_HIERARCHY } from '@/lib/db/schema';

// ── JWT Secret ──────────────────────────────────────────────────
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  return secret || 'meu-controle-secret-dev-key-change-in-production';
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ── JWT Payload ─────────────────────────────────────────────────
export interface JwtPayload {
  userId: number;
  lojaId: number | null;
  nomeLoja: string | null;
  email: string;
  role: UserRole;
}

// ── Token Signing & Verification ────────────────────────────────
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}

// ── Cookie Helpers ──────────────────────────────────────────────
export async function getAuthFromCookies(): Promise<JwtPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<JwtPayload> {
  const auth = await getAuthFromCookies();
  if (!auth) {
    throw new Error('Não autorizado');
  }
  return auth;
}

// ── Role-Based Access Guards ────────────────────────────────────

/** Requires the user has at least the given role level. */
export async function requireRole(minimumRole: UserRole): Promise<JwtPayload> {
  const auth = await requireAuth();
  const userLevel = ROLE_HIERARCHY[auth.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

  if (userLevel < requiredLevel) {
    throw new Error('Permissão insuficiente');
  }
  return auth;
}

/** Requires super_admin access. */
export async function requireSuperAdmin(): Promise<JwtPayload> {
  return requireRole('super_admin');
}

/** Requires admin (tenant admin) or higher. */
export async function requireAdmin(): Promise<JwtPayload> {
  return requireRole('owner');
}

/**
 * Requires authentication AND tenant access.
 * super_admin can access any tenant (for support/debug).
 */
export async function requireTenantAccess(targetLojaId?: number): Promise<JwtPayload> {
  const auth = await requireAuth();

  if (auth.role === 'super_admin') return auth;

  if (!auth.lojaId) {
    throw new Error('Usuário não vinculado a nenhuma loja');
  }

  if (targetLojaId !== undefined && auth.lojaId !== targetLojaId) {
    throw new Error('Acesso negado a este recurso');
  }

  return auth;
}

/**
 * Requires auth and a valid lojaId (rejects super_admin without tenant context).
 * Use this in all tenant-scoped API routes.
 */
export async function requireAuthWithTenant(): Promise<JwtPayload & { lojaId: number }> {
  const auth = await requireAuth();
  if (!auth.lojaId) {
    throw new Error('Operação requer contexto de loja');
  }
  return auth as JwtPayload & { lojaId: number };
}

/** Same as requireAdmin but guarantees lojaId is set. */
export async function requireAdminWithTenant(): Promise<JwtPayload & { lojaId: number }> {
  const auth = await requireAdmin();
  if (!auth.lojaId) {
    throw new Error('Operação requer contexto de loja');
  }
  return auth as JwtPayload & { lojaId: number };
}

// ── Permission check helpers (no throw) ─────────────────────────
export function hasRole(auth: JwtPayload, minimumRole: UserRole): boolean {
  return (ROLE_HIERARCHY[auth.role] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0);
}

export function isSuperAdmin(auth: JwtPayload): boolean {
  return auth.role === 'super_admin';
}

export function isAdmin(auth: JwtPayload): boolean {
  return hasRole(auth, 'owner');
}
