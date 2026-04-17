import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db, usuarios } from '@/lib/db';

const DEFAULT_TECH_NAME = process.env.TECH_ADMIN_NAME || 'Guilherme';
const DEFAULT_TECH_EMAIL = process.env.TECH_ADMIN_EMAIL || 'guilherme@meucontrole.com';
const DEFAULT_TECH_PASSWORD = process.env.TECH_ADMIN_PASSWORD || 'admin123';

/**
 * Ensures the platform super admin exists once the database is provisioned.
 * This keeps first access simple on a fresh Railway database.
 */
export async function ensurePlatformSuperAdmin() {
  const [existingUser] = await db
    .select({
      id: usuarios.id,
      role: usuarios.role,
    })
    .from(usuarios)
    .where(eq(usuarios.email, DEFAULT_TECH_EMAIL))
    .limit(1);

  if (existingUser) {
    return existingUser;
  }

  const senhaHash = await bcrypt.hash(DEFAULT_TECH_PASSWORD, 10);

  const [createdUser] = await db
    .insert(usuarios)
    .values({
      lojaId: null,
      nome: DEFAULT_TECH_NAME,
      email: DEFAULT_TECH_EMAIL,
      senhaHash,
      role: 'super_admin',
      ativo: true,
    })
    .returning({
      id: usuarios.id,
      role: usuarios.role,
    });

  return createdUser;
}
