import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithTenant } from '@/lib/auth';
import { db, categorias, produtos } from '@/lib/db';
import { eq, and, count } from 'drizzle-orm';

// PUT: admin only
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminWithTenant();
    const { id } = await params;
    const catId = parseInt(id, 10);
    const body = await request.json();
    const { nome, icone } = body;

    if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome da categoria é obrigatório' },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({ id: categorias.id })
      .from(categorias)
      .where(and(eq(categorias.id, catId), eq(categorias.lojaId, auth.lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Categoria não encontrada' },
        { status: 404 }
      );
    }

    await db
      .update(categorias)
      .set({ nome: nome.trim(), icone: icone || null })
      .where(and(eq(categorias.id, catId), eq(categorias.lojaId, auth.lojaId)));

    const [categoria] = await db
      .select({
        id: categorias.id,
        nome: categorias.nome,
        icone: categorias.icone,
        criadoEm: categorias.criadoEm,
      })
      .from(categorias)
      .where(and(eq(categorias.id, catId), eq(categorias.lojaId, auth.lojaId)))
      .limit(1);

    return NextResponse.json({ categoria });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Erro ao atualizar categoria' },
      { status: 500 }
    );
  }
}

// DELETE: admin only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminWithTenant();
    const { id } = await params;
    const catId = parseInt(id, 10);

    const [existing] = await db
      .select({ id: categorias.id })
      .from(categorias)
      .where(and(eq(categorias.id, catId), eq(categorias.lojaId, auth.lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Categoria não encontrada' },
        { status: 404 }
      );
    }

    const [produtosVinculados] = await db
      .select({ count: count() })
      .from(produtos)
      .where(and(eq(produtos.categoriaId, catId), eq(produtos.lojaId, auth.lojaId)));

    if (produtosVinculados.count > 0) {
      return NextResponse.json(
        { error: 'Categoria possui produtos vinculados' },
        { status: 400 }
      );
    }

    await db
      .delete(categorias)
      .where(and(eq(categorias.id, catId), eq(categorias.lojaId, auth.lojaId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Erro ao excluir categoria' },
      { status: 500 }
    );
  }
}
