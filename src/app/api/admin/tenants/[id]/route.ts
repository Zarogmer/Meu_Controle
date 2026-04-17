import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { db, lojas, usuarios } from '@/lib/db';
import { eq, desc, asc, sql } from 'drizzle-orm';

/** GET: View tenant details with all users. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const lojaId = parseInt(id, 10);

    const [loja] = await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!loja) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
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
      .where(eq(usuarios.lojaId, lojaId))
      .orderBy(desc(usuarios.role), asc(usuarios.nome));

    return NextResponse.json({ loja, usuarios: userList });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/** PUT: Update tenant (suspend, change name, etc.). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const lojaId = parseInt(id, 10);

    const [existing] = await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { nome, segmento, ativo, logoUrl, corPrimaria } = body;

    // Build update fields using COALESCE-like logic
    const updateFields: Record<string, unknown> = {};
    if (nome !== undefined && nome !== null) updateFields.nome = nome;
    if (segmento !== undefined && segmento !== null) updateFields.segmento = segmento;
    if (ativo !== undefined) updateFields.ativo = ativo;
    if (logoUrl !== undefined && logoUrl !== null) updateFields.logoUrl = logoUrl;
    if (corPrimaria !== undefined && corPrimaria !== null) updateFields.corPrimaria = corPrimaria;

    if (Object.keys(updateFields).length > 0) {
      await db
        .update(lojas)
        .set(updateFields)
        .where(eq(lojas.id, lojaId));
    }

    const [loja] = await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    return NextResponse.json({ loja });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/** DELETE: Remove tenant and all associated data. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const lojaId = parseInt(id, 10);

    const [existing] = await db
      .select({ id: lojas.id })
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    // Delete users first, then the loja (cascade should handle it, but be explicit)
    await db.delete(usuarios).where(eq(usuarios.lojaId, lojaId));
    await db.delete(lojas).where(eq(lojas.id, lojaId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
