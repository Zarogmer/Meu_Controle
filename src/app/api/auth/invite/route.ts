import { db, usuarios } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, asc } from 'drizzle-orm';

/** Tenant Admin creates a new user (employee) for their store. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();

    if (!auth.lojaId) {
      return NextResponse.json(
        { error: 'Usuário não vinculado a uma loja' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nome, email, senha, role } = body;

    if (!nome || !email || !senha) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (senha.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Tenant Admin can only create employees (not admins or super_admins)
    const allowedRoles = ['employee'];
    // If the user is super_admin, allow creating admins too
    if (auth.role === 'super_admin') {
      allowedRoles.push('owner');
    }

    const targetRole = role || 'employee';
    if (!allowedRoles.includes(targetRole)) {
      return NextResponse.json(
        { error: `Você não pode criar usuários com o papel "${targetRole}"` },
        { status: 403 }
      );
    }

    const [existingUser] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 400 }
      );
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const [inserted] = await db
      .insert(usuarios)
      .values({
        lojaId: auth.lojaId,
        nome,
        email,
        senhaHash,
        role: targetRole as 'owner' | 'employee',
      })
      .returning({ id: usuarios.id });

    return NextResponse.json({
      success: true,
      user: {
        id: inserted.id,
        nome,
        email,
        lojaId: auth.lojaId,
        role: targetRole,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    console.error('Erro ao convidar usuário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/** Tenant Admin lists users in their store. */
export async function GET() {
  try {
    const auth = await requireAdmin();

    if (!auth.lojaId) {
      return NextResponse.json(
        { error: 'Usuário não vinculado a uma loja' },
        { status: 400 }
      );
    }

    const userList = await db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        role: usuarios.role,
        ativo: usuarios.ativo,
        criadoEm: usuarios.criadoEm,
      })
      .from(usuarios)
      .where(eq(usuarios.lojaId, auth.lojaId))
      .orderBy(desc(usuarios.role), asc(usuarios.nome));

    return NextResponse.json({ usuarios: userList });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
